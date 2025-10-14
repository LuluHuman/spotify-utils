import axios from 'axios';
import { TOTP } from "totp-generator"

export async function generateTokenUrl() {
	const secretAPI = await axios.get(
		"https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretBase32.json"
	);
	const { version, secret } = secretAPI.data;


	if (!version) return;
	const { otp } = TOTP.generate(secret);
	const tokenURL = `https://open.spotify.com/api/token?reason=init&productType=web-player&totp=${otp}&totpVer=${version}`;
	console.log(tokenURL);

	return tokenURL;
}
