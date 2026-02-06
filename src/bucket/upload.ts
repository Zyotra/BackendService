import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./s3";
import fs from "fs";
import path from "path";

export const uploadFile = async (filePath: string, key?: string) => {
  const fileStream = fs.createReadStream(filePath);

  const fileName = key || path.basename(filePath);

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: `${fileName}`,
    Body: fileStream,
    ContentType: "application/octet-stream", // optional, auto-detect if needed
  });

  await s3.send(command);
  console.log(`File uploaded successfully as ${fileName}`);
};
