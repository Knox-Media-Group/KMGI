/* SocialEnrollr - Frontend JavaScript */

document.addEventListener('DOMContentLoaded', function() {

    // --- Copy to Clipboard ---
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const text = this.dataset.copy;
            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                const original = this.textContent;
                this.classList.add('copied');
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.classList.remove('copied');
                    this.textContent = original;
                }, 1500);
            }).catch(() => {
                // Fallback for older browsers
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);

                const original = this.textContent;
                this.classList.add('copied');
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.classList.remove('copied');
                    this.textContent = original;
                }, 1500);
            });
        });
    });

    // --- Auto-dismiss flash messages ---
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.3s';
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });

});
