import { Lyrics } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseBoxedTs(lyr: string) {
    const timeToMs = (timeStr: string) => {
        const parts = timeStr.split(":");
        const minutes = parseFloat(parts[0]);
        const seconds = parseFloat(parts[1]);
        return (minutes * 60 + seconds) * 1000;
    };

    const children = [];

    const lyrData = lyr
        .split("\n")
        .map((line, index, array) => {
            const timeMatch = line.match(/\[(.*?)\]/);
            if (!timeMatch) return null;

            const startTime = timeToMs(timeMatch[1]);
            const text = line.replace(/\[.*?\]/, "").trim();

            let endTime;
            if (index < array.length - 1) {
                const nextTimeMatch = array[index + 1].match(/\[(.*?)\]/);
                if (nextTimeMatch) endTime = timeToMs(nextTimeMatch[1]);
                else endTime = Infinity;
            } else endTime = startTime;

            return {
                msStart: startTime,
                msEnd: endTime,
                isOppositeAligned: false,
                element: text,
                isInstrumental: text == "",
            };
        })
        .filter((item) => item !== null);

    children.push({
        msStart: 0,
        msEnd: lyrData[0] ? lyrData[0].msStart : 0,
        isInstrumental: true,
        element: "",
    });

    children.push(...lyrData);
    return children;
}
export function parseLyricsmxm(lyr: any) {
    const children = [];
    children.push({
        msStart: 0,
        msEnd: Math.floor(lyr[0].ts * 1000),
        isInstrumental: true,
        element: "",
    });

    for (let i = 0; i < lyr.length; i++) {
        const line = lyr[i];
        const sylChildren = [];
        for (let c = 0; c < line.l.length; c++) {
            const char = line.l[c];
            const charNext = line.l[c + 1];

            sylChildren.push({
                msStart: Math.floor((line.ts + char.o) * 1000),
                msEnd: Math.floor((charNext ? line.ts + charNext.o : line.te) * 1000),
                element: char.c,
            });
        }

        children.push({
            msStart: Math.floor(line.ts * 1000),
            msEnd: Math.floor(line.te * 1000),
            isOppositeAligned: false,
            element: "",
            children: sylChildren,
        });

        if (!lyr[i + 1]) continue;
        const nextLyricLine = lyr[i + 1];
        const lyricEnd = Math.floor(line.te * 1000);
        const instrumEnd = nextLyricLine.ts * 1000;
        InsertInstrumental(children, lyricEnd, instrumEnd);
    }
    return children;
}

export function parseLyricsBeuLyr(lyr: any) {
    switch (lyr.Type) {
        case "Line":
            const lyricLines = lyr.Content;
            const children = [];
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

            const children = [];
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
                        });
                    }

                    children.push({
                        msStart: lyricLine.Background[0].StartTime * 1000,
                        msEnd: lyricLine.Background[0].EndTime * 1000,
                        isOppositeAligned: lyricLine.OppositeAligned,
                        isBackground: true,
                        element: "",
                        children: bgSylChildren,
                    });
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

// function parseLyricsSpotify(lyricLines) {
//     const children = [];
//     children.push({
//         msStart: 0,
//         msEnd: lyricLines[0] ? lyricLines[0].StartTime : 0,
//         isInstrumental: true,
//         element: "",
//     });

//     for (let i = 0; i < lyricLines.length; i++) {
//         const lyricLine = lyricLines[i];

//         const lyricStart = lyricLine.StartTime;
//         const lyricEnd = lyricLine.EndTime;

//         children.push({
//             msStart: lyricStart,
//             msEnd: lyricEnd,
//             isOppositeAligned: lyricLine.OppositeAligned,
//             element: lyricLine.Text,
//             isInstrumental: lyricLine.Text == "",
//         });
//     }

//     return children;
// }

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
