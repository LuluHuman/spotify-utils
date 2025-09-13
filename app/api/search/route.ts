import axios from 'axios';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
    try {

        const searchParams = req.nextUrl.searchParams
        const trackId: string | null = searchParams.get('id')
        const accessToken = req.headers.get("authorization")
        if (!accessToken) return Response.json({ err: "No Auth" }, { status: 400 })
        if (!trackId) return Response.json({ err: "No query id" }, { status: 400 })

        const { getTrack, getTrackMeta, getAlbum } = init(accessToken)

        const track = (await getTrack(trackId)).data
        const metaTrack = (await getTrackMeta(idToGid(trackId))).data
        const metaAlbum = (await getAlbum(metaTrack.album.gid)).data

        return Response.json({ track, metaTrack, metaAlbum })
    }
    catch (err) {
        return Response.json({ err }, { status: err.status || 500 })
    }

}

function idToGid(id: string) {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    let val = BigInt("0");
    for (let i = 0; i < id.length; i++) {
        const digit = alphabet.indexOf(id.charAt(i));
        val = val * BigInt("62") + BigInt(digit);
    }
    const gid = val.toString(16).padStart(32, "0");
    return gid
}

function init(accessToken: string) {
    console.log(accessToken);

    function getTrack(trackId: string) {
        return axios.get("https://api.spotify.com/v1/tracks/" + trackId, { headers: { Authorization: accessToken } })
    }

    function getTrackMeta(trackGid: string) {
        const url = `https://spclient.wg.spotify.com/metadata/4/track/${trackGid}`
        return axios.get(url, { headers: { Authorization: accessToken } })
    }

    function getAlbum(albumGid: string) {
        const url = `https://spclient.wg.spotify.com/metadata/4/album/${albumGid}`
        return axios.get(url, { headers: { Authorization: accessToken } })
    }

    return { getTrack, getTrackMeta, getAlbum }
}