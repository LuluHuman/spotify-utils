import { Lyrics } from "@/lib/types";

// const roundDec = (p: number) => (p > 1 ? 1 : p < 0 ? 0 : Number.isNaN(p) ? 1 : p);

export interface LyricsState {
	forSongId?: string;
	data: Lyrics[];
	lyricType?: string;
	lyrSource?: string;
	lyrCopyright?: string;
}

export default function LyricView({ lyrics: lyrcs }: { lyrics: LyricsState }) {
	if (typeof lyrcs == "string") return <>{lyrcs}</>;

	const widths = ["w-28", "w-52", "w-full"];
	if (!lyrcs.data[0])
		return (
			<div className="flex flex-col *:my-2 *:bg-neutral-400 *:rounded-3xl *:text-transparent *:opacity-50">
				{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => {
					return (
						<span
							key={i}
							className={widths[i % 3]}>
							.
						</span>
					);
				})}
			</div>
		);
	return (
		<>
			{lyrcs.data?.map((x) =>
				parseLines(
					x,
					lyrcs.lyricType as "Line" | "Syllable" | "Static" | "queue" | undefined
				)
			)}
			<span className="text-sm opacity-25 whitespace-break-spaces wrap-anywhere">
				{"Lyrics provided by " + lyrcs.lyrSource + lyrcs.lyrCopyright}
			</span>
		</>
	);
}

function parseLines(
	{
		i,
		isInstrumental,
		isOppositeAligned,
		isBackground,
		msStart,
		msEnd,
		element: rawElement,
		children,
	}: Lyrics,
	showing: "Line" | "Syllable" | "Static" | "queue" | undefined
) {
	let element: React.JSX.Element | React.JSX.Element[] | string = rawElement;

	const lineType = isInstrumental ? "instrumental " : `text-xl m-1 w-full `;
	const lineAignment = isOppositeAligned ? "text-right " : "text-left ";

	if (isInstrumental) {
		element = (
			<div className={`instrumentalText animation `}>
				<span />
				<span />
				<span />
			</div>
		);
	}

	if (showing == "Syllable" && children) {
		element = children.map(({ msStart, msEnd, element: elementT }) => {
			const bgClass = isBackground ? "text-sm bg " : "";
			return (
				<span
					ref={(ref) => {
						ref?.setAttribute("start", msStart.toString());
						ref?.setAttribute("end", msEnd.toString());
					}}
					className={bgClass}
					key={`${msStart} - ${msEnd}: ${elementT.toString()}`}>
					{elementT}
				</span>
			);
		});
	}

	return (
		<span
			className={`${lineType + lineAignment} opacity-50`}
			ref={(ref) => {
				ref?.setAttribute("start", msStart.toString());
				ref?.setAttribute("end", msEnd.toString());
				if (isBackground) ref?.setAttribute("isBackground", "1");
			}}
			// onClick={() => SpotifyClient?.SeekTo(Math.ceil(msStart))}
			key={showing == "Static" ? i : `${msStart} - ${msEnd}: ${element.toString()}`}>
			{element}
		</span>
	);
}
