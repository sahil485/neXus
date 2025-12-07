import { inngest } from "./client";
import { TwitterApi } from "twitter-api-v2";

// Background job: Scrape user's network
export const scrapeNetwork = inngest.createFunction(
  { 
    id: "scrape-network",
    name: "Scrape X Network"
  },
  { event: "scrape/network.requested" },
  async ({ event, step }) => {
    const { userId, username, accessToken, accessSecret } = event.data;

    // Step 1: Initialize Twitter client
    const client = await step.run("init-twitter-client", async () => {
      return new TwitterApi({
        appKey: process.env.TWITTER_CLIENT_ID!,
        appSecret: process.env.TWITTER_CLIENT_SECRET!,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });
    });

    // Step 2: Fetch following (in chunks to avoid timeout)
    const following = await step.run("fetch-following", async () => {
      const result = await client.v2.following(userId, {
        max_results: 100, // Process 100 at a time
        "user.fields": ["description", "public_metrics", "profile_image_url"],
      });
      
      return result.data || [];
    });

    // Step 3: Save to database (you'll call your Supabase client here)
    await step.run("save-to-db", async () => {
      // TODO: Save to Supabase
      // For now, just log
      console.log(`Scraped ${following.length} users for ${username}`);
      
      // Example:
      // await supabase.from('x_profiles').upsert(following.map(user => ({
      //   x_user_id: user.id,
      //   username: user.username,
      //   name: user.name,
      //   bio: user.description,
      //   ...
      // })));
      
      return { count: following.length };
    });

    return { 
      success: true, 
      profilesScraped: following.length,
      username 
    };
  }
);

// You can add more functions here:
// - scrapeTweets
// - indexProfiles
// - generateEmbeddings
// etc.

