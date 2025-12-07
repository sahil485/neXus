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

    // Fetch 1st degree connections
    const { data: firstDegree, error: firstError } = await supabase
      .from('x_connections')
      .select(`
        following_id,
        x_profiles!x_connections_following_id_fkey (
          x_user_id,
          username,
          name,
          bio,
          profile_image_url,
          followers_count,
          following_count
        )
      `)
      .eq('follower_id', userId)
      .limit(100);

    if (firstError) {
      console.error("Error fetching 1st degree:", firstError);
    }

    // Fetch 2nd degree connections
    // Get who the 1st degree connections follow
    const firstDegreeIds = firstDegree?.map((c: any) => c.following_id) || [];
    
    let secondDegree: any[] = [];
    if (firstDegreeIds.length > 0) {
      const { data, error: secondError } = await supabase
        .from('x_connections')
        .select(`
          following_id,
          x_profiles!x_connections_following_id_fkey (
            x_user_id,
            username,
            name,
            bio,
            profile_image_url,
            followers_count,
            following_count
          )
        `)
        .in('follower_id', firstDegreeIds)
        .not('following_id', 'eq', userId) // Exclude the current user
        .not('following_id', 'in', `(${firstDegreeIds.join(',')})`) // Exclude 1st degree
        .limit(200);

      if (secondError) {
        console.error("Error fetching 2nd degree:", secondError);
      } else {
        secondDegree = data || [];
      }
    }

    // Format profiles
    const profiles = [
      ...(firstDegree?.map((c: any) => ({
        ...c.x_profiles,
        degree: 1,
      })) || []),
      ...(secondDegree?.map((c: any) => ({
        ...c.x_profiles,
        degree: 2,
      })) || []),
    ].filter(p => p.x_user_id); // Remove any null profiles

    return NextResponse.json({
      success: true,
      profiles,
      count: {
        first: firstDegree?.length || 0,
        second: secondDegree?.length || 0,
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

