import { inngest } from "./client";

// Background job: Scrape user's network
export const scrapeNetwork = inngest.createFunction(
  { 
    id: "scrape-network",
    name: "Scrape X Network"
  },
  { event: "scrape/network.requested" },
  async ({ event, step }) => {
    const { userId, username, accessToken } = event.data;

    // Step 1: Fetch following from X API
    const following = await step.run("fetch-following", async () => {
      try {
        // Call X API v2 to get following
        const response = await fetch(
          `https://api.twitter.com/2/users/${userId}/following?max_results=100&user.fields=description,public_metrics,profile_image_url`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Twitter API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data || [];
      } catch (error) {
        console.error("Error fetching following:", error);
        return [];
      }
    });

    // Step 2: Save to database
    await step.run("save-to-db", async () => {
      // TODO: Save to Supabase
      // For now, just log
      console.log(`Scraped ${following.length} users for ${username}`);
      
      // Example using Supabase (you'll need to set this up):
      /*
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const profiles = following.map((user: any) => ({
        x_user_id: user.id,
        username: user.username,
        name: user.name,
        bio: user.description,
        followers_count: user.public_metrics?.followers_count || 0,
        following_count: user.public_metrics?.following_count || 0,
        profile_image_url: user.profile_image_url,
      }));
      
      await supabase.from('x_profiles').upsert(profiles);
      
      // Store connections
      const connections = following.map((user: any) => ({
        from_user_id: userId,
        to_user_id: user.id,
        degree: 1,
      }));
      
      await supabase.from('connections').upsert(connections);
      */
      
      return { count: following.length };
    });

    return { 
      success: true, 
      profilesScraped: following.length,
      username 
    };
  }
);
