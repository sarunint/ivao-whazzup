import * as request from 'request'
import * as zlib from 'zlib'
import { BuildModelsError } from './errors/build-models-error'
import { ParseError } from './errors/parse-error'
import { DownloadFileError } from './errors/download-file-error'
import { WhazzupATC } from './models/atc'
import { WhazzupPilot } from './models/pilot'
import { Client } from './utils/enums'
import { WhazzupFileContent } from './utils/whazzup-file-content'
import { WhazzupRequestResult } from './utils/whazzup-request-result'

class WhazzupHandler {
  private readonly WHAZZUP_URL: string = 'http://api.ivao.aero/getdata/whazzup/whazzup.txt.gz'

  /**
   * Fetch Whazzup data from the IVAO Servers.
   */
  public fetchData(): Promise<WhazzupRequestResult> {
    return this.downloadWhazzupFile()
      .then(this.parseWhazzupFile)
      .then(this.buildModels)
  }

  /**
   * Download the Whazzup File from IVAO Server.
   */
  private downloadWhazzupFile(): Promise<Buffer> {
    return new Promise((res, rej) => {
      request.get({
        encoding: null,
        headers: {
          'Accept-Encoding' : 'gzip',
        },
        url: this.WHAZZUP_URL,
      }, (error, response, body) => {
        if (error || response.statusCode !== 200) {
          rej(new DownloadFileError(`There was a problem downloading the Whazzup File.
          The server answered with a ${response.statusCode} error`))
        }
        res(body)
      })
    })
  }

  /**
   * Parses the Whazzup File downloaded from IVAO Server.
   */
  private parseWhazzupFile(whazzupFile: Buffer): Promise<WhazzupFileContent> {
    return new Promise((res, rej) => {
      zlib.unzip(whazzupFile, (error: Error | null, buffer: Buffer): void => {
        if (error) {
          rej(new ParseError('There was a problem parsing the Whazzup file'))
        }
        const fileData: string = buffer.toString()
        const generalDataBegin: number = fileData.indexOf('!GENERAL')
        const clientsDataBegin: number = fileData.indexOf('!CLIENTS')
        const airportsDataBegin: number = fileData.indexOf('!AIRPORTS')
        const clientsData: string[] = fileData.substr(clientsDataBegin + 10,
          airportsDataBegin - clientsDataBegin - 12).split('\n')
        const generalData: string[] = fileData.substr(generalDataBegin + 9,
          clientsDataBegin - 10).split('\n')
        const whazzupFileContent: WhazzupFileContent = new WhazzupFileContent(generalData, clientsData)
        res(whazzupFileContent)
      })
    })
  }

  /**
   * Build models from the parsed Whazzup file data.
   */
  private buildModels(fileContent: WhazzupFileContent): Promise<WhazzupRequestResult> {
    return new Promise((res, rej) => {
      try {
        const retrievedPilots: WhazzupPilot[] = []
        const retrievedATCs: WhazzupATC[] = []
        let retrievedClients: number = 0
        for (const line of fileContent.clientsData) {
          const clientData: string[] = line.split(':')
          if (clientData[3] === Client.Pilot) {
            retrievedPilots.push(new WhazzupPilot(clientData))
          } else {
            retrievedATCs.push(new WhazzupATC(clientData))
          }
          retrievedClients++
        }
        const requestResult: WhazzupRequestResult = new WhazzupRequestResult(fileContent, retrievedPilots,
          retrievedATCs, retrievedClients)
        res(requestResult)
      } catch (error) {
        rej(new BuildModelsError('There was a problem building the models'))
      }
    })
  }
}

export const Whazzup = new WhazzupHandler()
