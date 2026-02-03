import CryptoJS from "crypto-js";
const decryptVpsPassword = (encryptedPassword: string): string => {
    const encriptionAlgorithm = process.env.ENCRYPTION_ALGORITHM
    if (!encriptionAlgorithm) {
        throw new Error("Encryption algorithm not specified in environment variables");
    }
    //@ts-ignore
    const decrypted = CryptoJS[encriptionAlgorithm].decrypt(encryptedPassword, process.env.ENCRYPTION_KEY as string).toString(CryptoJS.enc.Utf8);
    return decrypted;
}
export default decryptVpsPassword;