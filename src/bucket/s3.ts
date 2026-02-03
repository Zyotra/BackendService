import { S3 } from "@aws-sdk/client-s3";

export const s3=new S3({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID || "",
        secretAccessKey: process.env.SECRET_ACCESS_KEY || ""
    }
})
export default s3;