import CryptoJS from "crypto-js";
const decryptVpsPassword = (encryptedPassword: string): string => {
    const encriptionAlgorithm = process.env.ENCRYPTION_ALGORITHM
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encriptionAlgorithm) {
        throw new Error("Encryption algorithm not specified in environment variables");
    }
    if (!encryptionKey) {
        throw new Error("Encryption key not specified in environment variables");
    }
    if (!encryptedPassword || encryptedPassword.trim() === "") {
        throw new Error("Encrypted password is empty");
    }
    //@ts-ignore
    const decrypted = CryptoJS[encriptionAlgorithm].decrypt(encryptedPassword, encryptionKey).toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
        throw new Error("Failed to decrypt password. Check encryption configuration");
    }
    return decrypted;
}
export default decryptVpsPassword;