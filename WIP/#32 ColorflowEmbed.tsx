/**
 *  32
 * #32 Colorflow Embed
 */
import { addPropertyControls, ControlType } from "framer"

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */
export default function ColorflowEmbed(props: ColorflowEmbedProps) {
    const { src, showBorder, allowFullscreen, style } = props

    return (
        <iframe
            src={src}
            title="Colorflow Embed"
            style={{
                ...style,
                width: "100%",
                height: "100%",
                border: showBorder ? "1px solid rgba(0,0,0,0.12)" : "0",
                display: "block",
                background: "transparent",
            }}
            frameBorder={0}
            allowFullScreen={allowFullscreen}
        />
    )
}

type ColorflowEmbedProps = {
    src: string
    showBorder: boolean
    allowFullscreen: boolean
    style?: React.CSSProperties
}

ColorflowEmbed.defaultProps = {
    src: "https://colorflow.ls.graphics/embed.html#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-vE-ZlsyWGtmCc4mezUWzApvYE1+S9q6u1LcqO9zuZOsUE8WAfono+vkq9Vp-qLDpliJOHNIwg2TEjZKyFAjY1yvjQNaZSaAEpoidm9ieadVZoYQu3URKrnWWnIOVJ+bWRnOaOm21NaGWPPEIoCAeA6gQBcOgFt1iWm-IRKuOwNgUwCgzF1W2L8jIjqCWOqGE7E2oSRZ3eB8QnAyNmHI1CmbzX2BwjmjsDJ11Bw4io5EWK6YVv2TKTBlMupqI3mdO1FS44gDqXUTAZ5U6ctbU+H52c-l2F0tSPC3hkPfqrr+8YWS-CwoyFM5CSrk0qtTdhBDC6OMZpxVm6lLNZhft2RFLMiGfxcRQacs1B6q10uPQYwhFBLBMEsHwJgNA736QvlGDtOdRheEmSCAUyscIcSHT+6N5l5hxsTnKYRwHlVzLnXJjymBFOrLmpWgK+rC2KOLca2K5bA4wJCke7el1kqpRABQYg7orCzB2BAHFIIUsIG4AZPArRwgQGeUUPApRwQeIAJL8GgGVrIbTwh4E9XUOAygACiRA8BoTqFkFgEBsgwHuM87o7XEBhE4FAMoEBBggBoM+cE2WiC5bLDIQrEW8n1Cvc8oQhDLDKGYHAZl4IIBIFuqUX4fAoBnnG0RyOEBlDRjPItgAwsgR7WQYCNFwO9z7i2x7p34FAAHgxKYEUyx437UBFvPP9SDwwX3nTaEYJD6HGwZDPY2DAdrX3Zsfm0EwKBSAyisBChILI9ApAEHPMUX7LU0DvKYEwG472+DVCyC4aAQhMtFDgE8UnpgOdc69DAAAgkgUX4uACyCAiDOhG2N3AvA+DQHp8YSAfW6hHYEGgQQyV-BAA",
    showBorder: false,
    allowFullscreen: true,
}

addPropertyControls(ColorflowEmbed, {
    src: {
        type: ControlType.String,
        title: "URL",
        defaultValue: ColorflowEmbed.defaultProps.src,
    },
    showBorder: {
        type: ControlType.Boolean,
        title: "Border",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    allowFullscreen: {
        type: ControlType.Boolean,
        title: "Fullscreen",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
})
