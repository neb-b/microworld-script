import csv from 'csv-parser'
import fs from 'fs'
import { createObjectCsvWriter } from 'csv-writer'

const readCsv = (filePath: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = []
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results)
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

const writeCsv = (filePath: string, data: any[]): Promise<void> => {
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'row', title: 'ROW' },
      { id: 'response', title: 'RESPONSE' },
    ],
  })

  return csvWriter.writeRecords(data)
}

const sortCsv = async (inputFilePath: string, outputFilePath: string) => {
  try {
    const data = await readCsv(inputFilePath)
    data.sort((a, b) => parseInt(a.row) - parseInt(b.row))
    await writeCsv(outputFilePath, data)
    console.log('CSV sorted and saved successfully.')
  } catch (error) {
    console.error('Error processing CSV file:', error)
  }
}

const inputFilePath = './output.csv'
const outputFilePath = './sorted-output.csv'

sortCsv(inputFilePath, outputFilePath)
