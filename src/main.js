// imports
import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import BigNumber from "bignumber.js"
import ClothlyAbi from '../contract/clothly.abi.json'
import erc20Abi from '../contract/erc20.abi.json'

// setting global var, let, const
const ERC20_DECIMALS = 18
const ClothyContractAddress = "0x35DCCA4B67d6437466aB2A020Ac001C07023fcab" // clothly contact address
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" // cUSD contract address

let kit // the kit
let cart = [] // cart object to contain the cart cloth array (array of object)
let cartTotal = 1 // init cartTotal state
let contract // the contract
let clothes = [] // clothes object to contain the clothes cloth array (array of object)
let cartAddress = [] // cart address object to contain the cart addresses of chained transaction

// connect to celo wallet
const connectCeloWallet = async function () {
    if (window.celo) {
        notification("⚠️ Please approve this DApp to use it.")
        try {
            await window.celo.enable()
            notificationOff()

            const web3 = new Web3(window.celo)
            kit = newKitFromWeb3(web3)

            // accessing user account
            const accounts = await kit.web3.eth.getAccounts()
            kit.defaultAccount = accounts[0]

            // setting contract on the web3 using the kit
            contract = new kit.web3.eth.Contract(ClothlyAbi, ClothyContractAddress)
        } catch (error) {
            // error validation response
            notification(`⚠️ ${error}.`)
        }
    } else {
        // installation notice
        notification("⚠️ Please install the CeloExtensionWallet.")
    }
}

// approve traction notification
async function approve(_price) {
    // setting the cUSD contract on the web3 using the kit
    const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress)

    const result = await cUSDContract.methods
        .approve(ClothyContractAddress, _price)
        .send({ from: kit.defaultAccount })
    return result
}

// getting total balance in cUSD
const getBalance = async function () {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    // shifting and converting the balance to currency format
    //  using the "priceToCurrency()" below
    const cUSDBalance = priceToCurrency(totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS))
    document.querySelector("#balance").textContent = cUSDBalance
}

// get clothes
const getClothes = async function () {
    const _clothesLength = await contract.methods.getClothesLength().call()
    const _clothes = []
    for (let i = 0; i < _clothesLength; i++) {
        let _cloth = new Promise(async (resolve, reject) => {
            let p = await contract.methods.readCloth(i).call()
            resolve({
                index: i,
                owner: p[0],
                name: p[1],
                image: p[2],
                description: p[3],
                collection: p[4],
                price: new BigNumber(p[5]),
                sold: p[6],
            })
        })
        _clothes.push(_cloth)
    }
    clothes = await Promise.all(_clothes)
    renderClothes()
}

// rending cloth list
function renderClothes() {
    document.getElementById("clothes").innerHTML = ""
    clothes.forEach((_cloth) => {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4 mb-3 card cus-card position-relative"
        newDiv.innerHTML = clothesTemplate(_cloth)
        document.getElementById("clothes").appendChild(newDiv)
    })
}

// cloth template

function clothesTemplate(_cloth) {
    return `
    <img src="${_cloth.image}"
        class="card-img-top cus-rounded" alt="${_cloth.name} image" width="100%" height="100%"
        style="object-fit: cover;">
    <div class="price shadow fw-bold">
        <small class="fw-light">Price</small> ${priceToCurrency(_cloth.price.shiftedBy(-ERC20_DECIMALS).toFixed(2))} cUSD
        <br>
        <small class="fw-light">Sold</small> ${_cloth.sold}
        <br>
        <small>
            <a href="https://alfajores-blockscout.celo-testnet.org/address/${_cloth.owner}/transactions"
            target="_blank" rel="noopener noreferrer"
            class="fw-light p">${truncateAddress(_cloth.owner)}</a>
        </small>
    </div>
    <div class="collection fw-bold">
        <a href="!#">${_cloth.collection}</a>
    </div>
    <div class="card-body cus-card-body text-white blur">
        <h5 class="card-title">${_cloth.name}</h5>
        <p class="card-text">
            <small>
                ${truncateDescription(_cloth.description)}
            </small>
        </p>
            <button id="${_cloth.index}" class="add-to-cart btn btn-light p fw-bold">Add To Cart</button>
        Or
        <a id="${_cloth.index}" class="btn buyCloth btn-light p fw-bold">Buy</a>
    </div>
`
}

// truncate owner's address
function truncateAddress(_address) {
    return String(_address).substring(0, 10)
}

// truncate cloth description
function truncateDescription(_description) {
    return `${String(_description).substring(0, 150)}...`
}

// price to currency format
function priceToCurrency(price) {
    return parseFloat(price).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// notification on
function notification(_message) {
    document.querySelector(".alert").style.display = "block"
    document.querySelector("#notification").textContent = _message
}

// notification off
function notificationOff() {
    document.querySelector(".alert").style.display = "none"
}

// load functions on start
window.addEventListener("load", async () => {
    notification("Getting ready...")
    await connectCeloWallet()
    await getBalance()
    await getClothes()
    renderClothes()
    notificationOff()
    // empty cart notice
    if (cart.length <= 0) {
        document.getElementById("emptyCart").textContent = "Cart is empty!"
    }
})

// sell new cloth
document
    .querySelector("#addNewCloth")
    .addEventListener("click", async () => {
        const collectionOptions = document.getElementById("clothCollection")
        const collectionSelected = collectionOptions.options[collectionOptions.selectedIndex].value
        const _cloth = [
            document.getElementById("clothName").value,
            document.getElementById("clothImage").value,
            document.getElementById("clothDescription").value,
            collectionSelected,
            new BigNumber(document.getElementById("clothPrice").value).shiftedBy(ERC20_DECIMALS).toString(),
        ]

        notification(`Adding "${_cloth[0]}"...`)

        const checkIfEmpty = isEmptyObject(_cloth) // checking if form is empty on submission

        if (checkIfEmpty) {
            notification('"FORM" Can not be empty!!!')
        } else {
            try {
                const result = await contract.methods
                    .writeCloth(..._cloth)
                    .send({ from: kit.defaultAccount })
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
            notification(`You successfully added "${_cloth[0]}".`)
            getClothes()
            document.getElementById("clothImage").value = ""
            document.getElementById("clothName").value = ""
            document.getElementById("clothPrice").value = ""
            document.getElementById("clothDescription").value = ""
            collectionOptions.options[collectionOptions.selectedIndex].value = ""
        }
    })

// buying new cloth
document.querySelector("#clothes").addEventListener("click", async (e) => {
    if (e.target.className.includes("buyCloth")) {
        const index = e.target.id
        notification("⌛ Waiting for payment approval...")
        try {
            await approve(clothes[index].price.toString())
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
        notification(`⌛ Awaiting payment for "${clothes[index].name}"...`)
        try {
            const result = await contract.methods
                .buyCloth(index)
                .send({ from: kit.defaultAccount })
            notification(`🎉 You successfully bought "${clothes[index].name}".`)
            console.log(result)
            getClothes()
            getBalance()
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    }
})

// check if object is empty
function isEmptyObject(obj) {
    let arr = [];
    for (let key in obj) {
        arr.push(obj[key] !== undefined && obj[key] !== null && obj[key] !== "");
    }
    return arr.includes(false);
}





// CART FUNCTIONALITY
// Add item
document.querySelector("#clothes").addEventListener("click", (e) => {
    if (e.target.className.includes("add-to-cart")) {
        const index = e.target.id
        const _cloth = clothes[index]
        let isInCart = false // is item in cart?

        // check if item is already in cart
        if (cart.length > 0) {
            cart.forEach(item => {
                if (item.index === _cloth.index) {
                    isInCart = true;
                } else {
                    isInCart = false;
                }
            })
        }

        if (isInCart) {
            notification(`${_cloth.name} already in CART!`)
        } else {
            // push to cart object
            cart.push({
                owner: _cloth.owner,
                image: _cloth.image,
                name: _cloth.name,
                price: _cloth.price,
                description: _cloth.description,
                collection: _cloth.collection,
                sold: _cloth.sold,
                index: _cloth.index,
            })

            // get total sum before and after
            let oldSum = document.getElementById("totalSum").textContent
            let newSum = parseFloat(oldSum) + parseFloat(_cloth.price.shiftedBy(-ERC20_DECIMALS).toFixed(2))
            document.getElementById("totalSum").textContent = newSum

            notification(`${_cloth.name} has been added to CART!`)

            // clear out
            document.getElementById("emptyCart").textContent = ""
            renderCart();
            // getting cart total items
            document.querySelector("#cartTotal").textContent = cartTotal++
        }
    }
})

// buy cart
document.querySelector("#buyCart").addEventListener("click", async (e) => {
    if (e.target.className.includes("buy-cart")) {
        let totalSumPrice = document.getElementById("totalSum").textContent
        totalSumPrice = new BigNumber(parseFloat(totalSumPrice)).shiftedBy(ERC20_DECIMALS)

        if (totalSumPrice > 0) {
            notification("⌛ Waiting for payment approval...")
            try {
                await approve(totalSumPrice.toString())
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
            notification(`⌛ Awaiting payment for Cart...`)
            try {
                cart.forEach(item => {
                    cartAddress.push(item.owner)
                })
                await contract.methods.clearCartAddress() // clear the cart address in contract
                await contract.methods.addCartAddress(cartAddress) // add new cart addresses in contract
                const result = await contract.methods.buyCart(totalSumPrice) // call the buy cart

                notification(`You successfully bought "${totalSumPrice.shiftedBy(-ERC20_DECIMALS).toFixed(2)} cUSD" worth of clothes.`)

                // clear cart and update app
                document.getElementById("totalSum").textContent = 0
                document.getElementById("balance").textContent = 0
                cart = []
                cart.length = 0
                await contract.methods.clearCartAddress()
                document.getElementById("emptyCart").textContent = "Transaction completed, cart is empty!"
                renderCart()
                getClothes()
                getBalance()
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
        } else {
            notification(`Please add items to cart first`)
        }
    }
})

// render cart list
function renderCart() {
    document.getElementById("cart").innerHTML = ""
    cart.forEach((cartItem) => {
        const newDiv = document.createElement("div")
        const footerDiv = document.createElement("div")
        newDiv.className = "mb-3 d-flex"
        newDiv.innerHTML = cartTemplate(cartItem)
        document.getElementById("cart").appendChild(newDiv)
        document.getElementById("cart").appendChild(footerDiv)
    })
}

// cart template
function cartTemplate(_cloth) {
    return `
    <img src="${_cloth.image}"
        class="rounded" alt="${_cloth.name} image" width="200px" height="150px" style="object-fit: cover; padding-right: .5rem;">
    <div>
        <h6 class="card-title fw-bold">${_cloth.name}</h6>
        <b>${priceToCurrency(_cloth.price.shiftedBy(-ERC20_DECIMALS).toFixed(2))} cUSD</b>
        <p class="card-text">
            ${truncateDescription(_cloth.description)}
        </p>
    </div>
`
}