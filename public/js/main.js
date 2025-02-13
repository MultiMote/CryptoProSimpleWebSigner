const html = String.raw;

/**
 * @param {string} query
 * @param {HTMLElement} [base]
 * @returns {HTMLElement|null}
 */
const $q = (query, base) => (base ?? document).querySelector(query);

/**
 * @param {ParsedCert} cert
 * @returns {HTMLDivElement}
 */
const createCertCard = (cert) => {
  const card = document.createElement("div");
  card.className = "col-md-6";
  card.innerHTML = html`
    <div class="ms-card ms-border cert-card">
      <div class="ms-card-content">
        <p><strong class="cert-title"></strong></p>
        <p><strong class="cert-valid"></strong></p>
        <p>💼 <span class="cert-issuer"></span></p>
        <p>🎫 <span class="cert-serial"></span></p>
        <p>
          ⌚ Действует c
          <span class="valid-from"></span>
          по
          <span class="valid-to"></span>
        </p>
      </div>
      <div class="ms-card-btn">
        <button class="ms-btn ms-primary ms-outline">Выбрать -&gt;</button>
      </div>
    </div>
  `;
  $q(".ms-card", card).dataset.sha1 = cert.sha1;
  $q(".cert-valid", card).textContent = cert.valid ? "✅ Действительный" : "❌ Недействительный";
  $q(".cert-title", card).textContent = cert.name;
  $q(".cert-serial", card).textContent = cert.serial;
  $q(".cert-issuer", card).textContent = cert.issuer;
  $q(".valid-from", card).textContent = cert.validFrom;
  $q(".valid-to", card).textContent = cert.validTo;
  return card;
};

const onCadesInit = async () => {
  const infos = await cadesGetCerts();

  const certsEl = $q(".certs");
  certsEl.innerHTML = "";

  infos.forEach((i) => {
    const card = createCertCard(i);
    $q("button", card).onclick = () => {
      document.querySelectorAll(".cert-card").forEach((el) => {
        if (el.dataset.sha1 === i.sha1) {
          el.classList.add("selected");
        } else {
          el.classList.remove("selected");
        }
      });
      $q("button.sign").disabled = false;
    };
    certsEl.appendChild(card);
  });

  $q("button.sign").onclick = async () => {
    /** @type {File[]} */
    const files = $q(".sign-file").files;

    if (files.length !== 1) {
      alert("Файл не выбран");
      return;
    }

    const selectedCertCard = $q(".cert-card.selected");

    if (selectedCertCard === null) {
      alert("Сертификат не выбран");
      return;
    }

    const file = files[0];
    const b64data = await fileToBase64(file);
    const signFormat = $q(".sign-format").value;

    try {
      const signBase64 = await cadesDetachedSignCreate(selectedCertCard.dataset.sha1, b64data);
      if (signFormat === "p7s") {
        saveBase64("application/pkcs7-signature", signBase64, `${file.name}.p7s`);
      } else {
        const b64b64 = stringToBase64(signBase64);
        saveBase64("application/application/pgp-signature", b64b64, `${file.name}.sig`);
      }
    } catch (e) {
      alert(`Не удалось подписать: ${e}`);
    }
  };

  $q("button.verify-sign").onclick = async () => {
    /** @type {File[]} */
    const signedFiles = $q(".verify-file").files;

    if (signedFiles.length !== 1) {
      alert("Подписанный файл не выбран");
      return;
    }

    /** @type {File[]} */
    const signatureFiles = $q(".verify-sign-file").files;

    if (signatureFiles.length !== 1) {
      alert("Файл подписи не выбран");
      return;
    }

    const b64data = await fileToBase64(signedFiles[0]);

    const signatureExt = signatureFiles[0].name.split(".").pop().toLowerCase();
    const b64sign = signatureExt === "sig" ? await fileToText(signatureFiles[0]) : await fileToBase64(signatureFiles[0]);

    const signerCertsEl = $q(".signer-certs.row");
    const resultEl = $q(".check-result");
    const loadingEl = $q(".tab-check-contents .ms-loading");

    resultEl.classList.add("ms-display-none");
    loadingEl.classList.remove("ms-display-none");
    signerCertsEl.innerHTML = "";

    try {
      const certs = await cadesSignVerify(b64sign, b64data);
      certs.forEach((i) => {
        const card = createCertCard(i);
        $q(".ms-card-btn", card).classList.add("ms-display-none");
        signerCertsEl.appendChild(card);
      });

      resultEl.classList.remove("ms-display-none", "ms-primary");
      resultEl.classList.add("ms-secondary");

      $q(".check-result-message", resultEl).textContent = "Подпись верна";
    } catch (e) {
      console.log(e);
      resultEl.classList.remove("ms-display-none", "ms-secondary");
      resultEl.classList.add("ms-primary");
      $q(".check-result-message", resultEl).textContent = `Неверная подпись: ${e}`;
    }

    loadingEl.classList.add("ms-display-none");
  };
};

const onCadesInitError = (e) => {
  alert(e);
};

document.addEventListener("DOMContentLoaded", () => {
  cadesplugin.then(onCadesInit, onCadesInitError);

  $q(".tab-sign").onclick = (e) => {
    e.preventDefault();
    e.target.classList.add("ms-active");
    $q(".tab-check").classList.remove("ms-active");
    $q(".tab-check-contents").classList.add("ms-display-none");
    $q(".tab-sign-contents").classList.remove("ms-display-none");
  };

  $q(".tab-check").onclick = (e) => {
    e.preventDefault();
    e.target.classList.add("ms-active");
    $q(".tab-sign").classList.remove("ms-active");
    $q(".tab-sign-contents").classList.add("ms-display-none");
    $q(".tab-check-contents").classList.remove("ms-display-none");
  };
});
