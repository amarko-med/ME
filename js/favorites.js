// ============================================================
// favorites.js — Gestion des favoris
// ============================================================

function getFavorites() {
    return getFromStorage(STORAGE_KEYS.FAVORITES, []);
}
function saveFavorites(favs) {
    saveToStorage(STORAGE_KEYS.FAVORITES, favs);
    updateFavBadge();
    document.dispatchEvent(new CustomEvent('favoritesUpdated'));
}
function isFavorite(productId) {
    return getFavorites().includes(productId);
}
function toggleFavorite(productId) {
    let favs = getFavorites();
    if (favs.includes(productId)) {
        favs = favs.filter(id => id !== productId);
    } else {
        favs.push(productId);
    }
    saveFavorites(favs);
    return favs.includes(productId);
}
function updateFavBadge() {
    const badge = document.getElementById('favBadge');
    if (!badge) return;
    const count = getFavorites().length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}