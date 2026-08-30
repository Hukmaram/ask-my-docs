import { EmbeddingClient } from '../src/embeddings/embedding.client.js';

const embeddingClient = new EmbeddingClient();

// const text =
//   'Retrieval-Augmented Generation retrieves relevant ' +
//   'information from external knowledge sources and ' +
//   'provides it to a language model as context.';

// console.log('Creating embedding...\n');

// const embedding = await embeddingClient.embed(text);

// console.log('Embedding created successfully.');

// console.log(`Dimensions: ${embedding.length}`);

// console.log('\nFirst 10 values:');

// console.log(
//   embedding.slice(0, 10),
// );

const chunks = [
  'RAG retrieves relevant documents.',
  'Dense retrieval represents documents as vectors.',
  'The generator uses retrieved context.',
];

const embeddings =
  await embeddingClient.embedMany(chunks);
console.log(`Embeddings: ${embeddings}`)
console.log(
  `Embeddings: ${embeddings.length}`,
);

console.log(
  `Dimensions: ${embeddings[0]?.length}`,
);