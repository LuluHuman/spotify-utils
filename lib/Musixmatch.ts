/* eslint-disable @typescript-eslint/no-explicit-any */
export class Musixmatch {
    user_token: string
    constructor() {
        this.user_token = ""
        const token = localStorage.getItem("provider:musixmatch:token");
        if (token) {
            console.log("yes token: ", token);
            this.user_token = token
            this.checkExpiry().then((isExpired) => {
                if (!isExpired) return (this.user_token = token);

                console.log("expired");

                this.newSession();
            });
            return;
        }
        console.log("no token");

        this.newSession();
    }
    async makeRequest(url: string, query?: string, method?: "GET" | "POST" | "PUT" | "DELETE") {
        if (this.user_token === "") return
        const _url = "/api/proxy/" + encodeURIComponent(url) + `?usertoken=${this.user_token}&app_id=web-desktop-app-v1.0&${query}`
        return new Promise((resp, rej) => {
            const defaultOptions = {
                method: method || "GET",
                url: _url
            };

            fetch(_url, defaultOptions)
                .then((data) => data.json())
                .then((resApi) => resp(resApi))
                .catch((err) => {
                    if (!err.response) return resp(err);
                    if (err.response.status == 404) return resp(err);
                    if (err.response.status !== 401) return resp(err);
                    window.location.href = window.location.href
                });
        });
    }
    newSession() {
        return new Promise((resp, rej) => {
            const url = "https://apic-desktop.musixmatch.com/ws/1.1/token.get?app_id=web-desktop-app-v1.0"
            fetch(`/api/proxy/${encodeURIComponent(url)}`)
                .then((data) => data.json())
                .then(({ message: response }) => {
                    if (response.header.status_code === 200 && response.body.user_token) {
                        const token = response.body.user_token;
                        localStorage.setItem("lyrics-plus:provider:musixmatch:token", token);
                        this.user_token = token;
                        return resp(token);
                    } else if (response.header.status_code === 401) {
                        alert("Too many attempts Token");
                        console.log("Too many attempts");
                        rej("Too many attempts");
                    } else {
                        alert("Failed to refresh token");
                        console.error("Failed to refresh token", response);
                        rej("Failed to refresh token: " + response);
                    }
                })
                .catch((err) => {
                    alert("err");
                    console.log(err);
                });
        });
    }
    async checkExpiry() {
        const baseURL = "https://apic-desktop.musixmatch.com/ws/1.1/chart.tracks.get";
        const body = await this.makeRequest(baseURL);
        return (body as any).message?.header.status_code == 401;
    }
    searchSong(title: string, artist: string) {
        const _search = "https://apic-desktop.musixmatch.com/ws/1.1/track.search"
        return this.makeRequest(_search, `q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}`)
    }
    getSong(uri: string) {
        const baseURL = "https://apic-desktop.musixmatch.com/ws/1.1/track.get";

        const params: { [key: string]: string } = {
            namespace: "lyrics_richsynched",
            subtitle_format: "mxm",
            track_spotify_id: uri,
        };

        const query = Object.keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join("&");

        return this.makeRequest(baseURL, query);
    }
    getSubtitle(trackId: string) {
        const baseURL = "https://apic-desktop.musixmatch.com/ws/1.1/track.subtitle.get";

        const params: { [key: string]: string } = {
            track_id: trackId,
        };

        const query = Object.keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join("&");


        return this.makeRequest(baseURL, query);
    }
    getRichSync(trackId: string) {
        const baseURL = "https://apic-desktop.musixmatch.com/ws/1.1/track.richsync.get?";

        const params: { [key: string]: string } = {
            track_id: trackId,
        };

        const query = Object.keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join("&");
        return this.makeRequest(baseURL, query);
    }
}