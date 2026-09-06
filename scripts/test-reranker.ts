import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
} from '@huggingface/transformers';

const MODEL =
  'woxpas-ai/bge-reranker-v2-m3-onnx';

const tokenizer =
  await AutoTokenizer.from_pretrained(MODEL);

const model =
  await AutoModelForSequenceClassification.from_pretrained(
    MODEL,
    {
      dtype: 'q8',
    },
  );

const query =
  'How does retrieval augmented generation improve knowledge intensive NLP tasks?';

const documents = [
  'Retrieval-Augmented Generation combines retrieval with generation to improve performance on knowledge-intensive NLP tasks.',
  'The weather forecast predicts rain and strong winds tomorrow.',
];

for (const document of documents) {
  const inputs = await tokenizer(
    [query],
    {
      text_pair: [document],
      padding: true,
      truncation: true,
    },
  );

  const output = await model(inputs);

  console.log(
    output.logits.data,
  );

  console.log();
}