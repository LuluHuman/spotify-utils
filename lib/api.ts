/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserProfile } from "./types";

const host = {
    "pub": "https://api.spotify.com/v1",
    "internal": "https://spclient.wg.spotify.com",
    "partner": "https://api-partner.spotify.com",
    "gay": "https://gae2-spclient.spotify.com"
}

const hashes = {
    "editablePlaylists": "acb5390f2929bdcad4c6afe1c08bdbe09375f50fdb29d75244f67e9aee77ebc4",
    "isCurated": "e4ed1f91a2cc5415befedb85acf8671dc1a4bf3ca1a5b945a6386101a22e28a6",
    "decorateContextTracks": "8b8d939c5d6da65a3f1b9fbaa96106b27fd6ff1ae7205846d9de3ffbee3298ee",
    "fetchExtractedColors": "86bdf61bb598ee07dc85d6c3456d9c88eb94f33178509ddc9b33fc9710aa9e9c",
    "canvas": "1b1e1915481c99f4349af88268c6b49a2b601cf0db7bca8749b5dd75088486fc",
    "libraryV3": "e25e473b160efdd4ababa7d98aa909ce0e5ab9c49c81f6d040da077a09e34ab3",
    "userTopContent": "feb6d55177e2cbce2ac59214f9493f1ef2e4368eec01b3d4c3468fa1b97336e2",
    "profileAttributes": "53bcb064f6cd18c23f752bc324a791194d20df612d8e1239c735144ab0399ced"
}
// interface lyrLine {
//     StartTime: number;
//     EndTime: number;
//     Text: string;
// }

const cache: { [key: string]: any } = {
    colors: {},
    metadata: {},
    playlist: {},
}


export const URIto = {
    id: (uri: string) => {
        return uri.split(":")[2];
    },
    url: (uri: string) => {
        const uriParams = uri.split(":");
        const type = uriParams[1];
        switch (type) {
            case "image":
                return "https://i.scdn.co/image/" + uriParams[2];
            case "artist":
                return "https://api.spotify.com/v1/artists/" + uriParams[2];
            case "album":
                return "https://api.spotify.com/v1/albums/" + uriParams[2];
            case "track":
                return "https://api.spotify.com/v1/tracks/" + uriParams[2];
            case "playlist":
                return `https://api.spotify.com/v1/playlists/${uriParams[2]}?.fields=name%2C+images`;
        }
    },
};


//#region Sporify Class
export class Spotify {
    session: {
        accessToken: string,
        accessTokenExpirationTimestampMs: number,
        isAnonymous: boolean,
        clientId: string,
        err?: any,
        localDeviceId: string,
        activeDeviceId: string
    }
    isReady: boolean
    ready: (() => any)[]
    constructor() {
        this.session = {
            accessToken: "",
            accessTokenExpirationTimestampMs: 0,
            isAnonymous: false,
            clientId: "",
            localDeviceId: "",
            activeDeviceId: ""
        };
        this.ready = []
        this.isReady = false
        this.newSession();
    }
    async makeRequest(url: string, options?: {
        method?: "GET" | "POST" | "PUT" | "DELETE";
        withProxy?: boolean,
        body?: string
    }) {
        if (!this.session.accessToken) return { err: "Not Ready" };
        if (options?.withProxy) url = "/api/proxy/" + encodeURIComponent(url)
        return new Promise((resp) => {
            const defaultOptions = {
                method: options?.method || "GET",
                url: url,
                body: options?.body,
                params: { format: "json" },
                headers: {
                    "app-platform": "WebPlayer",
                    authorization: `Bearer ${this.session.accessToken}`,
                    Accept: "application/json",
                    "Content-Type": options?.body ? "application/json" : ""
                },
            };
            fetch(url, defaultOptions)
                .then((data) => data.json())
                .then((resApi) => {
                    resp(resApi);
                })
                .catch((err) => {
                    if (!err.response) {
                        resp(undefined);
                        return;
                    }
                    if (err.response.status == 404) {
                        resp({ err: "Not Found" });
                        return;
                    }
                    if (err.response.status !== 401) {
                        alert("Token Expired")
                        resp({ err: "Token Expired" })
                        return;
                    }

                    resp({ err });
                    console.log({ err });
                });
        });
    }
    operation(operationName: keyof typeof hashes, variables: any) {
        const encode = (str: any) => encodeURIComponent(JSON.stringify(str))
        const varables = encode(variables)
        const ext = encode({ "persistedQuery": { "version": 1, "sha256Hash": hashes[operationName] } })
        const params = `operationName=${operationName}&variables=${varables}&extensions=${ext}`
        const url = `${host.partner}/pathfinder/v1/query?${params}`
        return this.makeRequest(url)
    }

    //#region Connection
    addReadyListener(func: () => any) {
        if (this.isReady) func()
        this.ready.push(func)
    }
    newSession() {
        return new Promise((resp) => {
            fetch("/api/session")
                .then((data) => data.json())
                .then((res) => {
                    if (res.offline) return alert("Offline");
                    if (res.accessToken == "") return alert("Error No Access Token");

                    this.session = res;
                    this.isReady = true
                    this.ready.forEach(f => f());
                    console.info(`fired ${this.ready.length} ready events`)
                    console.info("Spotify session generated. Token: ", this.session.accessToken);
                    return resp(res);
                })
                .catch((err) => {
                    alert("err");
                    console.log(err);
                });
        });
    }
    async connectWs(connection_id: string) {
        const deviceID = randomID();
        this.session.localDeviceId = deviceID

        const accessToken = this.session.accessToken
        return await connectState(connection_id, deviceID, accessToken);

        function randomID() {
            const digits = function (length: number) {
                const bytes = crypto.getRandomValues(new Uint8Array(length));
                let str = "";
                for (let i = 0; i < bytes.length; i++) {
                    str += bytes[i].toString(16);
                }
                return str;
            };
            return (
                digits(4) + "-" + digits(2) + "-" + digits(2) + "-" + digits(2) + "-" + digits(6)
            );
        }

        async function connectState(connection_id: string, device_id: string, accessToken: string) {
            const headersList = {
                "x-spotify-connection-id": connection_id,
                authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            };

            const bodyContent = JSON.stringify({
                member_type: "CONNECT_STATE",
                device: {
                    device_info: {
                        capabilities: {
                            can_be_player: false,
                            hidden: true,
                            needs_full_player_state: true,
                        },
                    },
                },
            });

            const reqOptions = {
                method: "PUT",
                headers: headersList,
                body: bodyContent,
            };
            const request = await fetch(
                `${host.internal}/connect-state/v1/devices/hobs_${device_id}`,
                reqOptions
            ).then((d) => d.json());
            return request;
        }
    }


    //#region Me
    getMe(): Promise<UserProfile> {
        return this.operation("profileAttributes", {}) as Promise<UserProfile>
    }

    setDevice(deviceId: string) {
        return this.makeRequest(host.pub + "/me/player", {
            method: "PUT", body: JSON.stringify({ "device_ids": [deviceId] })
        })

    }
    getQueue() { return this.makeRequest(host.pub + "/me/player/queue") }
    async SeekTo(position_ms: number) {
        return this.makeRequest(host.pub + "/me/player/seek?position_ms=" + position_ms.toString(), { method: "PUT" });
    }
    getLibrary() {
        return this.operation("libraryV3", {
            "filters": [],
            "order": null,
            "textFilter": "",
            "features": ["LIKED_SONGS", "YOUR_EPISODES"],
            "limit": 50,
            "offset": 0,
            "flatten": false,
            "expandedFolders": [],
            "folderUri": null,
            "includeFoldersWhenFlattening": true
        })
    }

    getTop(
        topArtistsInput?: {
            offset: number,
            limit: number,
            sortBy: "AFFINITY",
            timeRange: "SHORT_TERM" | "MID_TERM" | "LONG_TERM"
        },
        topTracksInput?: {
            offset: number,
            limit: number, sortBy: "AFFINITY",
            timeRange: "SHORT_TERM" | "MID_TERM" | "LONG_TERM"
        }
    ) {
        // return this.makeRequest(host.pub + `/me/top/${type}?time_range=${time_range}`);
        return this.operation("userTopContent", {
            "includeTopArtists": topArtistsInput != undefined,
            "topArtistsInput": topArtistsInput || {
                "offset": 0,
                "limit": 0,
                "sortBy": "AFFINITY",
                "timeRange": "SHORT_TERM"
            },
            "includeTopTracks": topTracksInput != undefined,
            "topTracksInput": topTracksInput || {
                "offset": 0,
                "limit": 0,
                "sortBy": "AFFINITY",
                "timeRange": "SHORT_TERM"
            }
        })
    }

    //#region Playlists
    async getEditablePlaylists(uris: string[], folderUri?: string) {
        const varables = { "offset": 0, "limit": 50, "textFilter": "", uris, folderUri }
        return this.operation("editablePlaylists", varables)
    }
    getPlaylist(uri: string) {
        if (cache["playlist"][uri]) return cache["playlist"][uri]

        const playlistUrl = URIto.url(uri);
        if (!playlistUrl) return
        const req = this.makeRequest(playlistUrl)
        cache["playlist"][uri] = req
        return req
    }
    appendToPlaylist(playlistUri: string, trackUri: string) {
        return this.makeRequest(host.pub + `/playlists/${playlistUri}/tracks`, { method: "POST", body: JSON.stringify({ uris: [trackUri] }) });
    }
    removeFromPlaylist(playlistUri: string, trackUri: string) {
        return this.makeRequest(host.pub + `/playlists/${playlistUri}/tracks`, { method: "DELETE", body: JSON.stringify({ tracks: [{ uri: trackUri }] }) });
    }

    //#region Saved tracks (Liked)
    saveTrack(trackUri: string) {
        const id = URIto.id(trackUri)
        return this.makeRequest(host.pub + `/me/tracks`, { method: "PUT", body: JSON.stringify({ ids: [id] }) });
    }
    removeSavedTrack(trackUri: string) {
        const id = URIto.id(trackUri)
        return this.makeRequest(host.pub + `/me/tracks`, { method: "DELETE", body: JSON.stringify({ ids: [id] }) });
    }
    trackContains(uri: string) {
        const varables = { "uris": [uri] }
        return this.operation("isCurated", varables)
    }

    //#region Tracks
    getTrack(id: string) { return this.makeRequest(host.pub + "/tracks/" + id); }
    getTrackMetadata(trackId: string) {
        if (cache["metadata"][trackId]) return cache["metadata"][trackId]

        const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

        let val = BigInt("0");
        for (let i = 0; i < trackId.length; i++) {
            const digit = alphabet.indexOf(trackId.charAt(i));
            val = val * BigInt("62") + BigInt(digit);
        }
        const gid = val.toString(16).padStart(32, "0");
        const url = `${host.internal}/metadata/4/track/${gid}`
        const req = this.makeRequest(url);
        cache["metadata"][trackId] = req
        return req
    }

    //#region Design
    getCanvas(uri: string) { return this.operation("canvas", { uri }) }
    decorateTracks(uris: string[]) { return this.operation("decorateContextTracks", { uris }) }
    getLyrics(uri: string) {
        const id = URIto.id(uri)

        const url = `${host.internal}/color-lyrics/v2/track/${id}/image/noimagejustlyrics?format=json`;
        return this.makeRequest(url, { withProxy: true });
    }
    async getColors(albSrc: string | undefined) {
        const def = { colorDark: { hex: "" }, colorLight: { hex: "" }, };
        if (!albSrc) return def

        const url = albSrc.startsWith("spotify") ? (URIto.url(albSrc) as string) : albSrc;
        if (!url) return def;

        if (cache["colors"][albSrc]) return cache["colors"][albSrc]

        const req = this.operation("fetchExtractedColors", { uris: [url] })
        cache["colors"][albSrc] = req

        return req
    }

    //#region Playback
    async SkipTo({ active_device_id, uri, uid }: { active_device_id: string | undefined, uri: string, uid: string }) {
        const raw = JSON.stringify({
            "command": {
                "logging_params": {
                    "page_instance_ids": [],
                    "interaction_ids": [],
                    "command_id": "a766757ef6b622b97d3a1131a6fac93b"
                },
                "track": {
                    uri, uid,
                    "provider": "context"
                },
                "endpoint": "skip_next"
            }
        });
        return this.makeRequest(host.gay + `/connect-state/v1/player/command/from/0/to/${active_device_id}`, { method: "POST", body: raw });
    }

    // async playback(mode: "pause" | "play" | "skipNext" | "skipPrev" | "shuffle" | "repeat", options?: any) {
    //     switch (mode) {
    //         case "pause":
    //             return this.makeRequest(host.pub + "/me/player/pause", { method: "PUT" });
    //         case "play":
    //             return this.makeRequest(host.pub + "/me/player/play", { method: "PUT" });
    //         case "skipNext":
    //             return this.makeRequest(host.pub + "/me/player/next", { method: "POST" });
    //         case "skipPrev":
    //             return this.makeRequest(host.pub + "/me/player/previous", { method: "POST" });
    //         case "shuffle":
    //             return this.makeRequest(host.pub + `/me/player/shuffle?state=${options}`, { method: "PUT" });
    //         case "repeat":
    //             return this.makeRequest(host.pub + `/me/player/repeat?state=${options}`, { method: "PUT" });
    //         default:
    //             break;
    //     }
    // }

    async playback(mode: "resume" | "pause" | "play" | "skip_next" | "skip_prev" | "shuffle" | "repeat") {
        const raw = JSON.stringify({
            "command": {
                "logging_params": {
                    "page_instance_ids": [],
                    "interaction_ids": [],
                    "command_id": "1e7f04122f19e1674d823e689d0d1e95"
                },
                "endpoint": mode
            }
        });

        if (!this.session.clientId || !this.session.activeDeviceId) return

        const url = `${host.gay}/connect-state/v1/player/command/from/${this.session.clientId}/to/${this.session.activeDeviceId}`
        return this.makeRequest(url, { method: "POST", body: raw, })
    }
};