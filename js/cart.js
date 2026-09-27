// ============================================================
// cart.js — Gestion du panier
// ============================================================

function getCart() {
    return getFromStorage(STORAGE_KEYS.CART, []);
}
function saveCart(cart) {
    saveToStorage(STORAGE_KEYS.CART, cart);
    updateCartBadge();
    // On peut aussi déclencher un événement personnalisé
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}
function addToCart(productId, qty = 1) {
    const product = getProductById(productId);
    if (!product) return false;
    if (!isProductAvailable(product)) {
        showToast('Produit indisponible', 'error');
        return false;
    }
    let cart = getCart();
    const existing = cart.find(item => item.productId === productId);
    if (existing) {
        existing.quantity += qty;
    } else {
        cart.push({ productId, quantity: qty });
    }
    saveCart(cart);
    showToast(`${product.name} ajouté au panier`, 'success');
    return true;
}
function removeFromCart(productId) {
    let cart = getCart().filter(item => item.productId !== productId);
    saveCart(cart);
}
function updateCartQuantity(productId, qty) {
    const product = getProductById(productId);
    if (!product) return;
    if (qty <= 0) {
        removeFromCart(productId);
        return;
    }
    let cart = getCart();
    const item = cart.find(i => i.productId === productId);
    if (item) {
        item.quantity = qty;
    }
    saveCart(cart);
}
function clearCart() {
    saveCart([]);
}
function getCartCount() {
    return getCart().reduce((sum, item) => sum + item.quantity, 0);
}
function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const count = getCartCount();
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}
function getCartSubtotal() {
    const cart = getCart();
    const products = getProducts();
    return cart.reduce((sum, item) => {
        const p = products.find(pr => pr.id === item.productId);
        return sum + (p ? p.price * item.quantity : 0);
    }, 0);
}
function getDeliveryFee() {
    const subtotal = getCartSubtotal();
    return subtotal >= 300 ? 0 : 30; // Livraison gratuite dès 300 DH, sinon 30 DH
}
function getCartTotal() {
    return getCartSubtotal() + getDeliveryFee();
}