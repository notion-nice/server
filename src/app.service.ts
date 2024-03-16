import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as COS from 'cos-nodejs-sdk-v5';
import { unzip } from 'fflate';
import { fromHtml } from 'hast-util-from-html';
import { toMdast } from 'hast-util-to-mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import sitdownConverter from './sitdownConverter';
import { markdownToBlocks } from '@tryfabric/martian';

const cos = new COS({
  SecretId: process.env.SecretId,
  SecretKey: process.env.SecretKey,
});
// 存储桶名称，由bucketname-appid 组成，appid必须填入，可以在COS控制台查看存储桶名称。 https://console.cloud.tencent.com/cos5/bucket
const Bucket = process.env.Bucket;
// 存储桶Region可以在COS控制台指定存储桶的概览页查看 https://console.cloud.tencent.com/cos5/bucket/
// 关于地域的详情见 https://cloud.tencent.com/document/product/436/6224
const Region = process.env.Region;

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async converter(filePath: string, directoryName: string) {
    console.log('converter', path.join(process.cwd(), filePath));

    const file = await fs.readFile(path.join(process.cwd(), filePath));
    const zipData = new Uint8Array(file);

    return await saveFilesFromZip(zipData, directoryName);
  }

  async htmlToBlocks(html: string, source = 'html', toBlock = true) {
    let md = sitdownConverter.GFM(html);
    switch (source) {
      case 'Juejin':
        md = sitdownConverter.Juejin(html);
        break;
      case 'Zhihu':
        md = sitdownConverter.Zhihu(html);
        break;
      case 'Wechat':
        md = sitdownConverter.Wechat(html);
        break;
      case 'CSDN':
        md = sitdownConverter.CSDN(html);
        break;

      default:
        break;
    }
    if (!toBlock) {
      return md;
    }
    const blocks = markdownToBlocks(md);
    return blocks as any[];
  }

  async converterHtmlToBlocks(html: string, toBlock = true) {
    const hast = fromHtml(html, { fragment: true });
    const mdast = toMdast(hast);
    const markdown = toMarkdown(mdast);
    if (!toBlock) {
      return markdown;
    }
    // Markdown string to Notion Blocks
    const blocks = markdownToBlocks(markdown);
    return blocks as any[];
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

async function saveFilesFromZip(buffer: Uint8Array, directoryName: string) {
  const outputPath = path.join(__dirname, 'temp', directoryName);

  await fs.mkdir(outputPath, { recursive: true });

  // 解压缩 Buffer
  const unzipped = await asyncUnzip(buffer);

  let mdFilePath: string;
  let dirPath: string;

  for (const filename in unzipped) {
    const fileContent = unzipped[filename];
    const filePath = path.join(outputPath, filename);
    const fileKey = path.join(directoryName, filename);

    // 确保文件路径中的目录存在
    const directoryPath = path.dirname(filePath);
    await fs.mkdir(directoryPath, { recursive: true });

    // 保存文件到磁盘
    await fs.writeFile(filePath, fileContent);

    await cos.sliceUploadFile({
      Bucket: Bucket,
      Region: Region,
      Key: fileKey,
      FilePath: filePath,
    });
    if (filename.endsWith('.md')) {
      // 如果是 Markdown 文件，记录其路径
      mdFilePath = filePath;
      dirPath = path.dirname(fileKey);
    }
  }

  if (!mdFilePath) {
    throw new Error('Markdown file not found in the ZIP archive');
  }

  const mdFileContent = await fs.readFile(mdFilePath, { encoding: 'utf8' });

  await fs.rm(outputPath, { recursive: true, force: true });

  return { content: mdFileContent, url: dirPath };
}
