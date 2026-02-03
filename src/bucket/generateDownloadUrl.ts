import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "./s3";
export const generateDownloadUrl = async (bucketName: string, key: string) => {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });
    return await getSignedUrl(s3, command, { expiresIn: 300 });
};