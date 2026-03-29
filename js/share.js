export function generateShareLink(distributor) {
    const { name, stock_status } = distributor;
    
    // Status emoji mapping
    let emoji = '⚫';
    let statusText = 'Unknown';
    if (stock_status === 'available') { emoji = '🟢'; statusText = 'In Stock'; }
    else if (stock_status === 'low') { emoji = '🟡'; statusText = 'Low Stock'; }
    else if (stock_status === 'out') { emoji = '🔴'; statusText = 'Out of Stock'; }

    // Generate a deep link (MVP: just the app domain with a query param)
    // Assuming the app is hosted on github pages
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?agency=${distributor.id}`;

    const text = `${emoji} LPG Gas is currently ${statusText} at ${name || 'an agency'} right now.\n\nCheck real-time availability near you: ${shareUrl}`;

    // Use Web Share API if available (native share menu)
    if (navigator.share) {
        navigator.share({
            title: 'LPG Availability Update',
            text: text,
            url: shareUrl
        }).catch(err => {
            console.error("Error sharing:", err);
            fallbackWhatsAppShare(text);
        });
    } else {
        fallbackWhatsAppShare(text);
    }
}

function fallbackWhatsAppShare(text) {
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
}
