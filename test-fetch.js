const gplay = (require('google-play-scraper').default || require('google-play-scraper'));

async function testFetch() {
  try {
    console.log('Fetching app info for com.moveinsync.ets...');
    const appInfo = await gplay.app({ appId: 'com.moveinsync.ets' });
    console.log(`Title: ${appInfo.title}`);
    console.log(`Rating: ${appInfo.score} (${appInfo.ratings} ratings, ${appInfo.reviews} reviews)`);

    console.log('Fetching sample reviews...');
    const reviews = await gplay.reviews({
      appId: 'com.moveinsync.ets',
      sort: gplay.sort.NEWEST,
      num: 10
    });
    console.log(`Fetched ${reviews.data.length} sample reviews.`);
    if (reviews.data.length > 0) {
      console.log('Sample review:', {
        userName: reviews.data[0].userName,
        score: reviews.data[0].score,
        date: reviews.data[0].date,
        text: reviews.data[0].text?.substring(0, 100)
      });
    }
  } catch (err) {
    console.error('Error during fetch:', err.message);
  }
}

testFetch();
