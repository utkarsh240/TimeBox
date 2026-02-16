import { NextRequest } from "next/server"

export const proxy = (req: NextRequest) =>{

    const pathname = req.nextUrl.pathname

    const roomMatch = pathname.match(/^\/room\/([^/]+)$/)

    if(!roomMatch) return NextResponse.redirect(new URL("/", req.url))


}


export const config = {

    matcher: "/room/:path*"



}