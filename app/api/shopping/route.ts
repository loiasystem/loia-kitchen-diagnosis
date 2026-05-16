import { NextResponse } from "next/server";
import aliasMap from "@/data/alias_map.json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json(
      { error: "검색어가 없습니다." },
      { status: 400 }
    );
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "네이버 API 키가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const apiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
    query
  )}&display=3&start=1&sort=asc`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "네이버 쇼핑 API 요청에 실패했습니다." },
        { status: response.status }
      );
    }

    const data = await response.json();

    const items = data.items.map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ""),
      link: item.link,
      image: item.image,
      lprice: item.lprice,
      mallName: item.mallName,
      productId: item.productId,
    }));

    return new NextResponse(JSON.stringify({ query, items }), {
  status: 200,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
  },
});
  } catch (error) {
    return NextResponse.json(
      { error: "쇼핑 데이터를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}