(function () {
    'use strict';

    // Assemble contact links only after a click, outside the initial HTML.
    // This deters simple HTML scrapers; it is not protection against all bots.
    document.querySelectorAll('button[data-contact]').forEach(function (button) {
        button.addEventListener('click', function () {
            let link = document.createElement('a');
            link.className = 'contact-reveal contact-revealed';
            link.dataset.contact = button.dataset.contact;
            if (button.dataset.contact === 'phone') {
                let parts = ['48', '600', '556', '005'];
                link.href = 'tel:+' + parts.join('');
                link.textContent = '+' + parts.join(' ');
            } else if (button.dataset.contact === 'email') {
                let address = ['rkp', 'org', 'pl'].join('.') + '@' + ['wp', 'pl'].join('.');
                link.href = 'mailto:' + address;
                link.textContent = address;
            } else {
                return;
            }
            button.replaceWith(link);
            link.focus();
        });
    });
}());
