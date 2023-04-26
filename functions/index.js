const functions = require("firebase-functions");
const admin = require("firebase-admin");
const getPodcastData = require('./util/getPodcastData');

admin.initializeApp();

const db = admin.firestore();

exports.fetchPodcastMeta = functions.https.onRequest(async (req, res) => {
  try {
    const mainRef = db.collection("main");
    const snapshot = await mainRef.get();


    let snapshotPromise =  snapshot.docs.map((doc) => {
      return doc.data();
    });

    // Process the results array as needed
    const results = await Promise.all(snapshotPromise) 
    const rssFeeds = results[0].listed_rss_feeds
    
    const metaPromise = rssFeeds.map(async (item) => {
       return getPodcastData(item.rss_feed_url);
    });
    const metaData = await Promise.all(metaPromise);


    const deployPromise = metaData.map(async (item) => {
       return deployMetaData(item);
    });
    const deployed = await Promise.all(deployPromise);
    console.log("data", deployed)

    res.status(200).send(metaData);
  } catch (error) {
    console.error("Error fetching data from main collection:", error);
    res.status(500).send("Error fetching data from main collection");
  }
});


async function deployMetaData(metaData) {

  try {
    const selectedFields = ['title', 'date', 'media'];

    const podcastObj = {
      title: metaData.meta.title,
      episodes: metaData.items.map((item) => {
        const filteredItem = {};
        selectedFields.forEach((field) => {
          filteredItem[field] = item[field];
        });
        return filteredItem;
      })
    }
    const doc_id = generateDocumentId(podcastObj.title)
    await db.collection('podcasts').doc(doc_id).set(podcastObj);
    console.log(`Successfully deployed podcast "${podcastObj.title}" to Firestore.`);
  } catch (error) {
    console.error(`Error deploying podcast "${podcastObj.title}" to Firestore:`, error);
  }
}


function generateDocumentId(podcast_title) {
  // Convert the title to lowercase and replace spaces with underscores or hyphens
  const sanitizedTitle = podcast_title.toLowerCase().replace(/\s+/g, '_');

  // Remove any special characters, except underscores or hyphens
  const documentId = sanitizedTitle.replace(/[^a-z0-9_-]/g, '');

  return documentId;
}