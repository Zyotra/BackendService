import CryptoJS from "crypto-js";
const encryptVpsPassword = (password: string): string => {
    const encriptionAlgorithm = process.env.ENCRYPTION_ALGORITHM
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encriptionAlgorithm) {
        throw new Error("Encryption algorithm not specified in environment variables");
    }
    if (!encryptionKey) {
        throw new Error("Encryption key not specified in environment variables");
    }
    //@ts-ignore
    const encrypted = CryptoJS[encriptionAlgorithm].encrypt(password, encryptionKey).toString();
    return encrypted;
}
export default encryptVpsPassword;