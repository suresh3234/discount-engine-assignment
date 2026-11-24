/**
 * scripts/generate-sample-pdfs.js
 *
 * Generates test fixture PDFs matching the assignment brief:
 * 1. sample-data/cart.pdf (all 6 valid sample items)
 * 2. test/fixtures/malformed-cart.pdf (valid items + malformed rows: missing price, invalid shape)
 * 3. test/fixtures/empty-cart.pdf (header only, zero valid items)
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync, mkdirSync } from 'fs'

async function generateSamplePdf() {
  const doc = await PDFDocument.create()
  const page = doc.addPage([600, 400])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = 360

  // Header
  page.drawText('Order #OP-9921 | Date: 15 Jan 2025', {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.07, 0.1, 0.28),
  })

  y -= 30

  // Column Headers
  page.drawText('Product', { x: 50, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Brand', { x: 200, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Platform', { x: 340, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Base Price', { x: 480, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })

  y -= 20

  const items = [
    { product: 'Cushion Cover', brand: 'Natura Casa', platform: 'Amazon India', price: 'Rs.1,299' },
    { product: 'Bed Sheet Set', brand: 'Natura Casa', platform: 'Flipkart', price: 'Rs.849' },
    { product: 'Wall Shelf', brand: 'LivSpace Pro', platform: 'Amazon India', price: 'Rs.599' },
    { product: 'Ceramic Vase', brand: 'LivSpace Pro', platform: 'Noon', price: 'Rs.2,499' },
    { product: 'Cutting Board', brand: 'Nordic Basics', platform: 'Amazon India', price: 'Rs.449' },
    { product: 'Desk Organiser', brand: 'Nordic Basics', platform: 'Flipkart', price: 'Rs.899' },
  ]

  for (const item of items) {
    page.drawText(item.product, { x: 50, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(item.brand, { x: 200, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(item.platform, { x: 340, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(item.price, { x: 480, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    y -= 20
  }

  const bytes = await doc.save()
  mkdirSync('sample-data', { recursive: true })
  mkdirSync('test/fixtures', { recursive: true })
  writeFileSync('sample-data/cart.pdf', bytes)
  writeFileSync('test/fixtures/sample-cart.pdf', bytes)
  console.log('Generated sample-data/cart.pdf and test/fixtures/sample-cart.pdf')
}

async function generateMalformedPdf() {
  const doc = await PDFDocument.create()
  const page = doc.addPage([600, 400])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = 360

  // Header
  page.drawText('Order #OP-9921 | Date: 15 Jan 2025', {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.07, 0.1, 0.28),
  })

  y -= 30

  // Column Headers
  page.drawText('Product', { x: 50, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Brand', { x: 200, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Platform', { x: 340, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Base Price', { x: 480, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) })

  y -= 20

  const rows = [
    { product: 'Cushion Cover', brand: 'Natura Casa', platform: 'Amazon India', price: 'Rs.1,299' },
    // Malformed 1: Missing price
    { product: 'Ceramic Planter', brand: 'LivSpace Pro', platform: 'Amazon India', price: '' },
    { product: 'Bed Sheet Set', brand: 'Natura Casa', platform: 'Flipkart', price: 'Rs.849' },
    // Malformed 2: Non-numeric price
    { product: 'Throw Blanket', brand: 'Nordic Basics', platform: 'Flipkart', price: 'Rs.FREE' },
    { product: 'Wall Shelf', brand: 'LivSpace Pro', platform: 'Amazon India', price: 'Rs.599' },
  ]

  for (const item of rows) {
    page.drawText(item.product, { x: 50, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(item.brand, { x: 200, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(item.platform, { x: 340, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    if (item.price) {
      page.drawText(item.price, { x: 480, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    }
    y -= 20
  }

  const bytes = await doc.save()
  writeFileSync('test/fixtures/malformed-cart.pdf', bytes)
  console.log('Generated test/fixtures/malformed-cart.pdf')
}

async function generateEmptyPdf() {
  const doc = await PDFDocument.create()
  const page = doc.addPage([600, 400])
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Header only, zero items
  page.drawText('Order #OP-9921 | Date: 15 Jan 2025', {
    x: 50,
    y: 360,
    size: 14,
    font: fontBold,
    color: rgb(0.07, 0.1, 0.28),
  })

  const bytes = await doc.save()
  writeFileSync('test/fixtures/empty-cart.pdf', bytes)
  console.log('Generated test/fixtures/empty-cart.pdf')
}

async function main() {
  await generateSamplePdf()
  await generateMalformedPdf()
  await generateEmptyPdf()
}

main().catch(console.error)
