(function () {
    'use strict';

    if (!window.jQuery) {
        document.getElementById('script-error').hidden = false;
        document.getElementById('verify-button').disabled = true;
        return;
    }

    jQuery(function ($) {
        let $form = $('#verification-form');
        let $button = $('#verify-button');
        let $inputs = $form.find('input');
        let $result = $('#verification-result');
        let pending = false;

        function showResult(type, title, message, contact) {
            $result.removeClass('success danger error').addClass(type);
            $('#result-title').text(title);
            $('#result-message').text(message);
            $('#result-contact').prop('hidden', !contact);
            $result.prop('hidden', false);
            $result[0].focus();
        }

        function showError() {
            showResult('error', 'Nie udało się zweryfikować legitymacji',
                'Wystąpił błąd połączenia lub odpowiedzi usługi. Spróbuj ponownie później. Jeśli błąd nie znika, skorzystaj z weryfikacji telefonicznej lub mailowej.', true);
        }

        $inputs.on('input', function () {
            $result.prop('hidden', true);
        });

        $form.on('submit', function (event) {
            event.preventDefault();
            if (pending || !$form[0].reportValidity()) return;

            // Pola tekstowe zachowują zera na początku numeru.
            let licenceNumber = 'RKP/' + $('#licence-number').val() + '/' + $('#licence-year').val();
            pending = true;
            $inputs.prop('disabled', true);
            $button.prop('disabled', true);
            $('#button-label').text('Sprawdzanie…');
            $form.attr('aria-busy', 'true');
            $result.prop('hidden', true);

            $.ajax({
                url: $form.attr('data-api-url'),
                method: 'POST',
                contentType: 'application/json; charset=utf-8',
                dataType: 'json',
                data: JSON.stringify({ licenceNumber: licenceNumber }),
                timeout: 15000
            }).done(function (response) {
                // Odpowiedź musi dotyczyć wysłanego numeru i zawierać boolean.
                if (!response || response.licenceNumber !== licenceNumber || typeof response.valid !== 'boolean') {
                    showError();
                    return;
                }
                if (response.valid) {
                    showResult('success', 'Legitymacja jest ważna',
                        'Potwierdzamy ważność legitymacji o numerze ' + licenceNumber + '.', false);
                } else {
                    showResult('danger', 'Legitymacja nie jest ważna',
                        'Niestety, legitymacja o numerze ' + licenceNumber + ' nie jest ważna. Sprawdź poprawność wpisanych danych. W razie wątpliwości skontaktuj się z nami, aby dodatkowo potwierdzić wynik.', true);
                }
            }).fail(showError).always(function () {
                pending = false;
                $inputs.prop('disabled', false);
                $button.prop('disabled', false);
                $('#button-label').text('Sprawdź ważność');
                $form.attr('aria-busy', 'false');
            });
        });
    });
}());
