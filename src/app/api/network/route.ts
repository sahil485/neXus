import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create Supabase client with connection pooler for serverless
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const userId = session.user.x_user_id;

    // Fetch 1st degree connections (mutual_ids from x_connections)
    const { data: userConnection, error: connError } = await supabase
      .from('x_connections')
      .select('mutual_ids')
      .eq('x_user_id', userId)
      .single();

    if (connError) {
      console.error("Error fetching connections:", connError);
    }

    const firstDegreeIds = userConnection?.mutual_ids || [];

    let firstDegreeProfiles: any[] = [];
    if (firstDegreeIds.length > 0) {
      const { data, error: profileError } = await supabase
        .from('x_profiles')
        .select('x_user_id, username, name, bio, profile_image_url, followers_count, following_count')
        .in('x_user_id', firstDegreeIds);

      if (profileError) {
        console.error("Error fetching 1st degree profiles:", profileError);
      } else {
        firstDegreeProfiles = data || [];
      }
    }

    let secondDegreeProfiles: any[] = [];
    if (firstDegreeIds.length > 0) {
      const { data: secondConnections, error: secondConnError } = await supabase
        .from('x_connections')
        .select('mutual_ids')
        .in('x_user_id', firstDegreeIds);

      if (!secondConnError && secondConnections) {
        const secondDegreeIds = new Set<string>();
        secondConnections.forEach(conn => {
          if (conn.mutual_ids) {
            conn.mutual_ids.forEach((id: string) => secondDegreeIds.add(id));
          }
        });

        secondDegreeIds.delete(userId);
        firstDegreeIds.forEach((id: string) => secondDegreeIds.delete(id));

        if (secondDegreeIds.size > 0) {
          const secondDegreeArray = Array.from(secondDegreeIds);
          const batchSize = 500;
          const batches = [];

          for (let i = 0; i < secondDegreeArray.length; i += batchSize) {
            batches.push(secondDegreeArray.slice(i, i + batchSize));
          }

          for (const batch of batches.slice(0, 2)) { // Limit to first 2 batches (1000 profiles max)
            const { data, error: secondProfileError } = await supabase
              .from('x_profiles')
              .select('x_user_id, username, name, bio, profile_image_url, followers_count, following_count')
              .in('x_user_id', batch);

            if (secondProfileError) {
              console.error("Error fetching 2nd degree profiles:", secondProfileError);
            } else if (data) {
              secondDegreeProfiles.push(...data);
            }
          }
        }
      }
    }

    const profiles = [
      ...firstDegreeProfiles.map(p => ({ ...p, degree: 1 })),
      ...secondDegreeProfiles.map(p => ({ ...p, degree: 2 })),
    ];

    return NextResponse.json({
      success: true,
      profiles,
      count: {
        first: firstDegreeProfiles.length,
        second: secondDegreeProfiles.length,
        total: profiles.length,
      },
    });
  } catch (error) {
    console.error("Network fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch network" },
      { status: 500 }
    );
  }
}

