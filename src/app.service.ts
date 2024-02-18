import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import COS from 'cos-nodejs-sdk-v5';
import { unzip } from 'fflate';

const cos = new COS({
  SecretId: process.env.SecretId,
  SecretKey: process.env.SecretKey,
});
// 存储桶名称，由bucketname-appid 组成，appid必须填入，可以在COS控制台查看存储桶名称。 https://console.cloud.tencent.com/cos5/bucket
const Bucket = 'notion-nice-1253546688';
// 存储桶Region可以在COS控制台指定存储桶的概览页查看 https://console.cloud.tencent.com/cos5/bucket/
// 关于地域的详情见 https://cloud.tencent.com/document/product/436/6224
const Region = 'ap-guangzhou';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async converter(file: File, directoryName: string) {
    const arrayBuffer = await file.arrayBuffer();
    const zipData = new Uint8Array(arrayBuffer);
    const outputPath = path.join(__dirname, 'temp', directoryName);

    await fs.mkdir(outputPath, { recursive: true });

    const mdFilePath = await saveFilesFromZip(zipData, outputPath);

    return mdFilePath;
  }
}

/**
 * 将 fflate 的 unzip 方法转换为可以使用 Promise 的函数
 *
 */
const asyncUnzip = (input: Uint8Array) =>
  new Promise<{ [filename: string]: Uint8Array }>((resolve, reject) => {
    unzip(input, (error, unzipped) => {
      if (error) return reject(error);
      resolve(unzipped);
    });
  });

async function saveFilesFromZip(buffer: Uint8Array, outputPath: string) {
  // 确保输出路径存在
  await fs.mkdir(outputPath, { recursive: true });

  // 解压缩 Buffer
  const unzipped = await asyncUnzip(buffer);

  let mdFilePath: string;

  for (const filename in unzipped) {
    const fileContent = unzipped[filename];
    const filePath = path.join(outputPath, filename);

    // 确保文件路径中的目录存在
    const directoryPath = path.dirname(filePath);
    await fs.mkdir(directoryPath, { recursive: true });

    // 保存文件到磁盘
    await fs.writeFile(filePath, fileContent);

    const ret = await cos.sliceUploadFile({
      Bucket: Bucket,
      Region: Region,
      Key: filePath,
      FilePath: filePath,
    });
    if (filename.endsWith('.md')) {
      // 如果是 Markdown 文件，记录其路径
      mdFilePath = ret.Location;
    }
  }

  await fs.rm(outputPath, { recursive: true, force: true });

  if (!mdFilePath) {
    throw new Error('Markdown file not found in the ZIP archive');
  }

  return mdFilePath;
}
