import CryptoJS from "crypto-js";
const encryptVpsPassword = (password: string): string => {
    const encriptionAlgorithm = process.env.ENCRYPTION_ALGORITHM
    if (!encriptionAlgorithm) {
        throw new Error("Encryption algorithm not specified in environment variables");
    }
    //@ts-ignore
    const encrypted = CryptoJS[encriptionAlgorithm].encrypt(password, process.env.ENCRYPTION_KEY as string).toString();
    return encrypted;
}
export default encryptVpsPassword;