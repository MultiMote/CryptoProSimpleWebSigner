/**
 * @typedef {{
 *  name: string;
 *  issuer: string;
 *  valid: boolean;
 *  serial: string;
 *  validFrom: string;
 *  validTo: string;
 *  sha1: string;
 * }} ParsedCert
 */

/**
 * @returns {Promise<ParsedCert[]>}
 */
const cadesGetCerts = () => {
  return new Promise((resolve, reject) => {
    cadesplugin.async_spawn(
      function* (args) {
        const store = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");

        yield store.Open(
          cadesplugin.CAPICOM_CURRENT_USER_STORE,
          cadesplugin.CAPICOM_MY_STORE,
          cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        );

        const certs = yield store.Certificates;
        const certCount = yield certs.Count;

        const infos = [];

        for (let i = 1; i <= certCount; i++) {
          const cert = yield certs.Item(i);
          infos.push({
            valid: yield (yield cert.IsValid()).Result,
            name: yield cert.GetInfo(cadesplugin.CAPICOM_CERT_INFO_SUBJECT_SIMPLE_NAME),
            issuer: yield cert.GetInfo(cadesplugin.CAPICOM_CERT_INFO_ISSUER_SIMPLE_NAME),
            serial: yield cert.SerialNumber,
            sha1: yield cert.Thumbprint,
            validFrom: dayjs(yield cert.ValidFromDate).format("DD.MM.YYYY"),
            validTo: dayjs(yield cert.ValidToDate).format("DD.MM.YYYY"),
          });
        }

        return args[0](infos);
      },
      resolve,
      reject
    );
  });
};

/**
 *
 * @param {string} b64sign
 * @param {string} b64data
 * @returns {Promise<ParsedCert[]>} signer certs
 */
const cadesSignVerify = (b64sign, b64data) => {
  return new Promise((resolve, reject) => {
    cadesplugin.async_spawn(
      function* (args) {
        const data = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
        try {
          yield data.propset_ContentEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY);
          yield data.propset_Content(b64data);
          yield data.VerifyCades(b64sign, cadesplugin.CADESCOM_CADES_BES, true);
        } catch (err) {
          return args[1](cadesplugin.getLastError(err));
        }

        const signers = yield data.Signers;
        const signersCount = yield signers.Count;

        const infos = [];

        for (let i = 1; i <= signersCount; i++) {
          const signer = yield signers.Item(i);
          const cert = yield signer.Certificate;

          infos.push({
            valid: yield (yield cert.IsValid()).Result,
            name: yield cert.GetInfo(cadesplugin.CAPICOM_CERT_INFO_SUBJECT_SIMPLE_NAME),
            issuer: yield cert.GetInfo(cadesplugin.CAPICOM_CERT_INFO_ISSUER_SIMPLE_NAME),
            serial: yield cert.SerialNumber,
            sha1: yield cert.Thumbprint,
            validFrom: dayjs(yield cert.ValidFromDate).format("DD.MM.YYYY"),
            validTo: dayjs(yield cert.ValidToDate).format("DD.MM.YYYY"),
          });
        }

        return args[0](infos);
      },
      resolve,
      reject
    );
  });
};

/**
 *
 * @param {string} certSha1
 * @param {string} b64data
 * @returns {Promise<string>} Подпись PKCS7, закодированная base64
 */
const cadesDetachedSignCreate = (certSha1, b64data) => {
  return new Promise(function (resolve, reject) {
    cadesplugin.async_spawn(
      function* (args) {
        const store = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        yield store.Open(
          cadesplugin.CAPICOM_CURRENT_USER_STORE,
          cadesplugin.CAPICOM_MY_STORE,
          cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        );

        const certs = yield store.Certificates;
        const foundCerts = yield certs.Find(cadesplugin.CAPICOM_CERTIFICATE_FIND_SHA1_HASH, certSha1);
        const certsCount = yield foundCerts.Count;

        if (certsCount === 0) {
          return args[1](`Certificate ${certSha1} not found`);
        }
        const cert = yield foundCerts.Item(1);
        const signer = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
        yield signer.propset_Certificate(cert);
        yield signer.propset_CheckCertificate(true);

        const data = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
        // Значение свойства ContentEncoding должно быть задано
        // до заполнения свойства Content
        yield data.propset_ContentEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY);
        yield data.propset_Content(b64data);

        let b64result = "";
        try {
          b64result = yield data.SignCades(signer, cadesplugin.CADESCOM_CADES_BES, true);
        } catch (err) {
          return args[1](cadesplugin.getLastError(err));
        }

        yield store.Close();
        return args[0](b64result);
      },
      resolve,
      reject
    );
  });
};

/**
 * @param {File} file
 * @returns {Promise<string>} base64
 */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = (e) => reject(e);
    reader.onload = () => {
      const encoded = reader.result.split("base64,")[1];
      resolve(encoded);
    };
  });
};

/**
 * @param {File} file
 * @returns {Promise<string>} text
 */
const fileToText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onerror = (e) => reject(e);
    reader.onload = () => {
      resolve(reader.result);
    };
  });
};

/**
 * @param {string} str
 * @returns {string}
 */
const stringToBase64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
};

/**
 * @param {string} mime
 * @param {string} b64data
 * @param {string} fileName
 */
const saveBase64 = (mime, b64data, fileName) => {
  const linkSource = `data:${mime};base64,${b64data}`;
  const a = document.createElement("a");
  a.href = linkSource;
  a.target = "_self";
  a.download = fileName;
  a.click();
};
