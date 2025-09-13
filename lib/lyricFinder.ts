/* eslint-disable @typescript-eslint/no-explicit-any */
import { Spotify, URIto } from "./api";
import { parseBoxedTs, parseLyricsmxm } from "./lyricParse";
import { Musixmatch } from "./Musixmatch";
import { sylLine, Lyrics } from "./types";

const fetchLyrics = {
	beautifulLyrics: (Spotify: Spotify, uri: string) => {
		if (uri.includes("local")) return;
		const id = URIto.id(uri);
		const url = "https://beautiful-lyrics.socalifornian.live/lyrics/" + id;
		return Spotify.makeRequest(url, { withProxy: true }) as any;
	},
	lrclib: (title: string, artist: string) => {
		if (!title || !artist) return undefined;
		const url = `https://lrclib.net/api/get?track_name=${title}&artist_name=${artist}`;
		return fetch(url).then((d) => d.json());
	},

	Musixmatch: (MxMClass: Musixmatch, title: string, artist: string, uri: string) => {
		return new Promise(async (res) => {
			let track;
			if (uri) {
				const searchRes = await MxMClass.getSong(uri);
				const body = (searchRes as any)?.message.body;
				if (!body?.track) return res([]);
				track = body.track;
			} else if (title && artist) {
				const searchRes = await MxMClass.searchSong(title, artist);
				if (!searchRes) return res([]);

				const searchBody = (searchRes as any)?.message.body;
				if (!searchBody || !searchBody.track_list) return res([]);

				const firstResult = searchBody.track_list[0];
				if (!firstResult) return res([]);

				track = firstResult.track;
			}

			if (track.has_richsync) {
				const lyricRes = await MxMClass.getRichSync(track.track_id);

				if ((lyricRes as any)?.message.header.status_code === 401) {
					alert("Too many attempts");
					console.log("Too many attempts");
					return res([]);
				} else if ((lyricRes as any)?.message.header.status_code != 200) {
					alert("Failed to fetch lyrics");
					console.error("Failed to fetch lyrics", lyricRes);
					return res([]);
				}

				const lyricBody = (lyricRes as any)?.message.body;
				if (!lyricBody) return res([]);
				const lyric = lyricBody.richsync;

				const result = parseLyricsmxm(JSON.parse(lyric.richsync_body));
				return res({
					type: "Syllable",
					lyr: {
						lyrics: result,
						copyright:
							lyric.lyrics_copyright +
							"Musixmatch Source: https://www.musixmatch.com/lyrics/" +
							track.commontrack_vanity_id,
					},
				});
			}

			if (track.has_subtitles) {
				const lyricRes = await MxMClass.getSubtitle(track.track_id);

				if ((lyricRes as any)?.message.header.status_code === 401) {
					alert("Too many attempts");
					console.log("Too many attempts");
					return res([]);
				} else if ((lyricRes as any)?.message.header.status_code === 404) {
					console.log("No Lyric");
					return res([]);
				} else if ((lyricRes as any)?.message.header.status_code != 200) {
					alert("Failed to fetch lyrics");
					console.error("Failed to fetch lyrics", lyricRes);
					return res([]);
				}

				const lyricBody = (lyricRes as any)?.message.body;
				if (!lyricBody) return res([]);
				const lyric = lyricBody.subtitle;
				if (!lyric) return res([]);

				const lyricLines = parseBoxedTs(lyric.subtitle_body);

				return res({
					type: "Line",
					lyr: {
						lyrics: lyricLines,
						copyright:
							lyric.lyrics_copyright +
							"Musixmatch Source: https://www.musixmatch.com/lyrics/" +
							track.commontrack_vanity_id,
					},
				});
			}

			return res([]);
		});
	},
	spotify: (Spotify: Spotify, uri: string) => {
		return new Promise((res, rej) => {
			Spotify.getLyrics(uri)
				.then((lyr: any) => {
					if (lyr.lyrics.syncType !== "LINE_SYNCED") return res([]);
					const resu = lyr.lyrics.lines.map((line: any, index: number, array: any[]) => {
						const startTime = line.startTimeMs;

						let endTime;
						if (index < array.length - 1) {
							if (array[index + 1]) endTime = array[index + 1].startTimeMs;
							else endTime = Infinity;
						} else endTime = startTime;

						return {
							StartTime: startTime,
							EndTime: endTime,
							Text: line.words == "♪" ? "" : line.words,
						};
					});

					res(resu);
				})
				.catch((err) => {
					res([]);
				});
		});
	},
};

export async function findLyrics(
	{
		SpotifyClient,
		mxmClient,
	}: {
		SpotifyClient?: Spotify;
		mxmClient?: Musixmatch;
	},
	{ uri, title, artist }: { uri: string; title: string; artist: string }
) {
	const local = async () => {
		if (!uri.startsWith("spotify:track")) return undefined;

		const url = "https://spot-a-fly.luluhoy.tech/api/getLyrics/" + URIto.id(uri);
		const lyr = await SpotifyClient?.makeRequest(url, { withProxy: true }) as any;

		if (!lyr || !lyr.Type || lyr.Type == "Static") return;

		const lyricLines = parseLyricsBeuLyr(lyr);
		if (!lyricLines) return;

		return {
			source: "luluhoy.tech (meself)",
			type: lyr.Type,
			data: lyricLines,
		};
	};

	const beuLyr = async () => {
		if (!SpotifyClient) return;
		if (!uri.startsWith("spotify:track")) return undefined;

		const lyr = await fetchLyrics.beautifulLyrics(SpotifyClient, uri);
		if (!lyr || !lyr.Type || lyr.Type == "Static") return;

		const lyricLines = parseLyricsBeuLyr(lyr);
		if (!lyricLines) return;

		return {
			source: "beautiful-lyrics",
			type: lyr.Type as string,
			data: lyricLines,
		};
	};

	const mxmLyr = async () => {
		if (!mxmClient) return;

		const lyr = (await fetchLyrics.Musixmatch(mxmClient, title, artist, URIto.id(uri))) as any;

		if (!lyr.lyr) return undefined;
		return {
			source: "Musixmatch",
			type: lyr.type,
			data: lyr.lyr.lyrics,
			copyright: lyr.lyr.copyright,
		};
	};

	const lrclib = async () => {
		if (!title || !artist) return undefined;

		const lyr = await fetchLyrics.lrclib(title, artist);
		if (!lyr || lyr.instrumental || !lyr.syncedLyrics) return;
		const lyricLines = parseBoxedTs(lyr.syncedLyrics);
		if (!lyricLines) return;

		return {
			source: "lrclib",
			type: "Line",
			data: lyricLines,
		};
	};

	const spotify = async () => {
		if (!SpotifyClient) return;
		if (!uri.startsWith("spotify:track")) return undefined;

		const lyr = (await fetchLyrics.spotify(SpotifyClient, uri)) as Lyrics[];

		if (!lyr || !lyr[0]) return undefined;

		const lyricLines = parseLyricsBasic(lyr);
		return { source: "Musixmatch (through Spotify)", type: "Line", data: lyricLines };
	};

	const find = async () => {
		const c = [];

		const providers = [local, beuLyr, mxmLyr, lrclib, spotify];

		for (let i = 0; i < providers.length; i++) {
			const provider = await providers[i]();

			if (i > 3 && c.length > 0) return c[0];

			if (provider && provider.type != "Syllable") {
				c.push(provider);
				continue;
			}

			if (provider) return provider;
		}

		return { source: "text", data: "not-found" };
	};
	const lyr = await find();
	return lyr;
}

function parseLyricsBeuLyr(lyr: any): Lyrics[] | undefined {
	switch (lyr.Type) {
		// case "Static":
		// 	return (lyr.Lines as any[]).map((line: { Text: string }, i: number) => ({
		// 		msStart: 0,
		// 		msEnd: 0,
		// 		i: i,
		// 		element: <div>{line.Text} </div>,
		// 	})) as Lyrics[];

		case "Line":
			const lyricLines = lyr.Content;
			const children: Lyrics[] = [];
			children.push({
				msStart: 0,
				msEnd: lyricLines[0].StartTime * 1000,
				isInstrumental: true,
				element: "",
			});

			for (let i = 0; i < lyricLines.length; i++) {
				const lyricLine = lyricLines[i];

				const lyricStart = lyricLine.StartTime * 1000;
				const lyricEnd = lyricLine.EndTime * 1000;

				children.push({
					msStart: lyricStart,
					msEnd: lyricEnd,
					isOppositeAligned: lyricLine.OppositeAligned,
					element: lyricLine.Text,
				});

				if (!lyricLines[i + 1]) continue;

				const nextLyricLine = lyricLines[i + 1];
				const instrumEnd = parseInt(nextLyricLine.StartTime) * 1000;
				InsertInstrumental(children, lyricEnd, instrumEnd);
			}
			return children;
		case "Syllable": {
			const lyricLines = lyr.Content;

			const children: Lyrics[] = [];
			children.push({
				msStart: 0,
				msEnd: lyricLines[0].Lead.StartTime * 1000,
				isInstrumental: true,
				element: "",
			});

			for (let i = 0; i < lyricLines.length; i++) {
				const lyricLine = lyricLines[i];
				const leadSyllables = lyricLine.Lead.Syllables;

				const sylChildren = [];
				for (let ls = 0; ls < leadSyllables.length; ls++) {
					const leadSyllabl = leadSyllables[ls];
					const spacing = !leadSyllabl.IsPartOfWord ? " " : "";
					sylChildren.push({
						msStart: leadSyllabl.StartTime * 1000,
						msEnd: leadSyllabl.EndTime * 1000,
						element: leadSyllabl.Text + spacing,
					});
				}

				children.push({
					msStart: lyricLine.Lead.StartTime * 1000,
					msEnd: lyricLine.Lead.EndTime * 1000,
					isOppositeAligned: lyricLine.OppositeAligned,
					element: "",
					children: sylChildren,
				});

				if (lyricLine.Background) {
					const bgSylChildren = [];
					const bgSyllables = lyricLine.Background[0].Syllables;

					for (let ls = 0; ls < bgSyllables.length; ls++) {
						const bgSyllabl = bgSyllables[ls];
						const spacing = !bgSyllabl.IsPartOfWord ? " " : "";
						bgSylChildren.push({
							msStart: bgSyllabl.StartTime * 1000,
							msEnd: bgSyllabl.EndTime * 1000,
							element: bgSyllabl.Text + spacing,
						} as sylLine);
					}

					children.push({
						msStart: lyricLine.Background[0].StartTime * 1000,
						msEnd: lyricLine.Background[0].EndTime * 1000,
						isOppositeAligned: lyricLine.OppositeAligned,
						isBackground: true,
						element: "",
						children: bgSylChildren,
					} as Lyrics);
				}

				if (!lyricLines[i + 1]) continue;
				const nextLyricLine = lyricLines[i + 1];
				const lyricEnd = lyricLine.Lead.EndTime * 1000;
				const instrumEnd = parseInt(nextLyricLine.Lead.StartTime) * 1000;
				InsertInstrumental(children, lyricEnd, instrumEnd);
			}

			return children;
		}
		default:
			return undefined;
	}
}

function parseLyricsBasic(lyricLines: any) {
	const children: Lyrics[] = [];
	children.push({
		msStart: 0,
		msEnd: lyricLines[0] ? lyricLines[0].StartTime : 0,
		isInstrumental: true,
		element: "",
	});

	for (let i = 0; i < lyricLines.length; i++) {
		const lyricLine = lyricLines[i];

		const lyricStart = lyricLine.StartTime;
		const lyricEnd = lyricLine.EndTime;

		children.push({
			msStart: lyricStart,
			msEnd: lyricEnd,
			isOppositeAligned: lyricLine.OppositeAligned,
			element: lyricLine.Text,
			isInstrumental: lyricLine.Text == "",
		});
	}

	return children;
}

function InsertInstrumental(children: Lyrics[], start: number, end: number) {
	const isEmpty = start != end;
	const gap = end - start;
	if (isEmpty && gap > 2500) {
		const div = {
			msStart: start,
			msEnd: end - 100,
			isInstrumental: true,
			element: "",
		};
		children.push(div);
	}
}
