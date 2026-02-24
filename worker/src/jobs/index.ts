import { runTranscription } from "./transcription";
import { runLabelGeneration } from "./label-generation";
import { runThumbnailGeneration, runIndexing } from "./stubs";
import type { ProcessingJobType } from "../types";

export async function runJob(type: ProcessingJobType, sourceVideoId: string): Promise<void> {
  switch (type) {
    case "transcription":
      return runTranscription(sourceVideoId);
    case "label_generation":
      return runLabelGeneration(sourceVideoId);
    case "thumbnail_generation":
      return runThumbnailGeneration(sourceVideoId);
    case "indexing":
      return runIndexing(sourceVideoId);
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}
