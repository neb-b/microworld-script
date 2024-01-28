import fs from 'fs'
import csvParser from 'csv-parser'
import { OpenAI } from 'openai'
import { format } from 'fast-csv'

const openai = new OpenAI({
  apiKey: '',
})

const MODEL = 'gpt-4-1106-preview'
const RUN_COUNT = 250 // Set to 'FULL' or a specific number
const inputFilePath = './MicroWorldPrompt/Updated_MicroWorld_Prompts.csv'
const outputFilePath = 'output.csv'
const outputCsvStream = format({ headers: true })
const outputStream = fs.createWriteStream(outputFilePath, { flags: 'a' })
outputCsvStream.pipe(outputStream)

async function makeOpenAICall(prompt) {
  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.2,
    })
    return chatCompletion
  } catch (error) {
    console.error('Error in OpenAI call:', error)
    throw error
  }
}

function validateResponse(openAiResponse, rowNum) {
  let message = ''
  try {
    message = openAiResponse.choices[0].message.content
    const jsonApiResponse = message
      .trim()
      .replace(/^```json\n|\n```$/g, '')
      .replace(/\n```/g, '')

    const parsed = JSON.parse(jsonApiResponse)

    if (!Array.isArray(parsed)) {
      // Try checking if parsed is an object with "questions_and_solutions" key
      if (parsed.questions_and_solutions) {
        const { questions_and_solutions } = parsed
        if (!Array.isArray(questions_and_solutions) || questions_and_solutions.length !== 8) {
          throw new Error('Invalid JSON structure')
        }
        outputCsvStream.write({ row: rowNum, response: JSON.stringify(questions_and_solutions) })
        return
      }
    } else if (parsed.length !== 8) {
      throw new Error('Invalid JSON structure or incorrect number of questions')
    }
    outputCsvStream.write({ row: rowNum, response: JSON.stringify(parsed) })
  } catch (e) {
    console.error('Error processing row: ', message, rowNum)
    outputCsvStream.write({ row: rowNum, response: '' })
    console.error(e)
    throw error
  }
}

async function processCSVRow(row, rowNum) {
  console.log('Processing row: ', rowNum)
  try {
    const data = JSON.parse(row.Prompt)

    // if (
    //   data.requirements.language === 'Hindi' ||
    //   data.requirements.language === 'Swahili' ||
    //   data.requirements.language === 'Bengali'
    // ) {
    //   throw Error('skipping language')
    // }

    const response = await makeOpenAICall(JSON.stringify(row))
    validateResponse(response, rowNum)
  } catch (error) {
    console.error('Error processing row: ', rowNum)
  }
}

async function processInputFile(processedRows) {
  console.log('Already processed rows: ', processedRows.size)

  const rowsStillToBeProcessed = []
  let rowCount = 0

  fs.createReadStream(inputFilePath)
    .pipe(csvParser())
    .on('data', (row) => {
      rowCount++

      if (processedRows.has(rowCount.toString())) {
        return
      }

      console.log('Need to process row: ', rowCount)
      rowsStillToBeProcessed.push({ index: rowCount, row })
    })
    .on('end', async () => {
      let processedCount = 0
      for (
        let i = 0;
        i < rowsStillToBeProcessed.length && (RUN_COUNT === 'FULL' || processedCount < RUN_COUNT);
        i++
      ) {
        const rowData = rowsStillToBeProcessed[i]
        await processCSVRow(rowData.row, rowData.index) // Adjust row number accordingly
        processedCount++
      }
      console.log('CSV file processing completed.')
      outputCsvStream.end()
    })
}

async function processCSVFile() {
  // Determine already processed rows so they can be skipped on additional attempts
  const processedRows = new Set()

  fs.createReadStream(outputFilePath)
    .pipe(csvParser())
    .on('data', (row) => processedRows.add(row.row))
    .on('end', () => processInputFile(processedRows))
}

processCSVFile()
