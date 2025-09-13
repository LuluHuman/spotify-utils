import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { NextRequest } from 'next/server';
import { CookieJar } from 'tough-cookie';

const blacklistedHeaders = [
    "cf-connecting-ip", "cf-worker",
    "cf-ray", "cf-visitor", "cf-ew-via",
    "cdn-loop", "x-amzn-trace-id", "cf-ipcountry",
    "x-forwarded-for", "x-forwarded-host",
    "x-forwarded-proto", "forwarded",
    "x-real-ip", "host", "origin"
];

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
async function handler(
    req: NextRequest,
    { params }: { params: Promise<{ url: string }> }
) {
    try {
        const destination = decodeURIComponent((await params).url)

        const data = await req.text()
        const isEmptyJSON = data == "{}"
        const body = !isEmptyJSON ? data : undefined

        const reqHeaders: { [key: string]: string } = {}
        req.headers.entries().forEach(([headerKey, headerValue]) => {
            if (Object.keys(reqHeaders).includes(headerKey)) return
            if (headerKey.startsWith("x-replace-")) return reqHeaders[headerKey.replace("x-replace-", "")] = headerValue
            if (blacklistedHeaders.includes(headerKey.toLowerCase())) return
            reqHeaders[headerKey] = headerValue
        })

        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar }));
        const request = await client(destination, {
            responseType: 'arraybuffer',
            method: req.method,
            headers: reqHeaders,
            data: body,
            params: req.nextUrl.searchParams,
        })

        const resHeaders: { [key: string]: string } = {}
        for (const key in request.headers) {
            if (key == "content-length") continue // postman fks up with this header
            const value = request.headers[key];
            resHeaders[key] = value
        }

        return new Response(request.data, { status: request.status, headers: resHeaders })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        return new Response(err ? JSON.stringify(err.config?.data) || { err } : { err: "Unknown Error" }, { status: err.status || 500 })
    }

}