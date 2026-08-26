import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

async function generate() {
  const sourceImage = path.resolve('src/assets/images/minimal_app_icon_1787731172793.jpg');
  if (!fs.existsSync(sourceImage)) {
    console.error('Source image not found:', sourceImage);
    process.exit(1);
  }

  // 1. Create high-res PNG for Web UI and Tkinter iconphoto
  const png512 = path.resolve('public/app-icon.png');
  const png256 = path.resolve('public/icon-256.png');
  const png64 = path.resolve('public/icon-64.png');
  const png32 = path.resolve('public/icon-32.png');
  const png16 = path.resolve('public/icon-16.png');
  const rootPng = path.resolve('app_icon.png');

  // Create rounded squircle mask or clean crisp PNG
  const roundedCorners = Buffer.from(
    `<svg><rect x="0" y="0" width="512" height="512" rx="100" ry="100"/></svg>`
  );

  await sharp(sourceImage)
    .resize(512, 512)
    .composite([{ input: roundedCorners, blend: 'dest-in' }])
    .png()
    .toFile(png512);

  await sharp(png512).resize(256, 256).png().toFile(png256);
  await sharp(png512).resize(64, 64).png().toFile(png64);
  await sharp(png512).resize(32, 32).png().toFile(png32);
  await sharp(png512).resize(16, 16).png().toFile(png16);

  fs.copyFileSync(png256, rootPng);

  // 2. Generate multi-resolution app.ico for Windows .EXE and Taskbar
  const icoBuffer = await pngToIco([png256, png64, png32, png16]);
  fs.writeFileSync(path.resolve('app.ico'), icoBuffer);
  fs.writeFileSync(path.resolve('public/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.resolve('public/app-icon.ico'), icoBuffer);

  console.log('Successfully generated app.ico, app_icon.png, and web icon assets!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
