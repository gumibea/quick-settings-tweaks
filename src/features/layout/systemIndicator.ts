import * as Main from "resource:///org/gnome/shell/ui/main.js"
import { SystemIndicator } from "resource:///org/gnome/shell/ui/quickSettings.js"
import { FeatureBase, type SettingLoader } from "../../libs/shell/feature.js"
import { SystemIndicatorTracker } from "../../libs/shell/quickSettingsUtils.js"
import { SystemIndicatorOrderItem } from "../../libs/types/systemIndicatorOrderItem.js"
import { StyleClass } from "../../libs/shared/styleClass.js"
import Maid from "../../libs/shared/maid.js"
import Global from "../../global.js"
import St from "gi://St"

const PRIVACY_INDICATOR_STYLE_CLASS = "privacy-indicator"
const PRIVACY_INDICATOR_USE_ACCENT_STYLE_CLASS = "QSTWEAKS-privacy-indicator-use-accent"
const PRIVACY_INDICATOR_USE_MONOCHROME_STYLE_CLASS = "QSTWEAKS-privacy-indicator-use-monochrome"

export class SystemIndicatorLayoutFeature extends FeatureBase {
	// #region settings
	orderEnabled: boolean
	order: SystemIndicatorOrderItem[]
	unordered: SystemIndicatorOrderItem
	privacyIndicatorStyle: "default" | "monochrome" | "accent"
	accentScreenSharingIndicator: boolean
	accentScreenRecordingIndicator: boolean
	override loadSettings(loader: SettingLoader): void {
		this.orderEnabled = loader.loadBoolean("system-indicator-layout-enabled")
		this.order = loader.loadValue("system-indicator-layout-order")
		this.unordered = this.order.find(item => item.nonOrdered)
		this.privacyIndicatorStyle = loader.loadString("system-indicator-privacy-indicator-style") as SystemIndicatorLayoutFeature["privacyIndicatorStyle"]
		this.accentScreenSharingIndicator = loader.loadBoolean("system-indicator-screen-sharing-indicator-use-accent")
		this.accentScreenRecordingIndicator = loader.loadBoolean("system-indicator-screen-recording-indicator-use-accent")
	}
	// #endregion settings

	onIndicatorCreated(maid: Maid, indicator: SystemIndicator): void {
		const rule: SystemIndicatorOrderItem =
			this.order.find(item => SystemIndicatorOrderItem.indicatorMatch(item, indicator))
			?? this.unordered
		if (rule.hide) maid.hideJob(indicator)
	}
	onUpdate(): void {
		const children = Global.Indicators.get_children()
		const head: SystemIndicator[] = []
		const middle: SystemIndicator[] = children.filter(child => child instanceof SystemIndicator) as any
		const tail: SystemIndicator[] = []
		let overNonOrdered: boolean = false
		for (const item of this.order) {
			if (item.nonOrdered) {
				overNonOrdered = true
				continue
			}
			const middleIndex = middle.findIndex(toggle => SystemIndicatorOrderItem.indicatorMatch(item, toggle))
			if (middleIndex == -1) continue
			const toggle = middle[middleIndex]
			middle.splice(middleIndex, 1);
			(overNonOrdered ? tail : head).push(toggle)
		}
		let last: SystemIndicator|null = null
		for (const item of [head, middle, tail].flat()) {
			if (last) Global.Indicators.set_child_above_sibling(item, last)
			last = item
		}
	}

	tracker: SystemIndicatorTracker
	private applyPrivacyIndicatorStyle(maid: Maid, indicator: SystemIndicator): void {
		const indicatorIcon = (indicator as any)._indicator as St.Icon|undefined
		if (!indicatorIcon) return
		let updating = false
		const updateStyle = () => {
			if (updating) return
			updating = true
			try {
				indicatorIcon.remove_style_class_name(PRIVACY_INDICATOR_USE_ACCENT_STYLE_CLASS)
				indicatorIcon.remove_style_class_name(PRIVACY_INDICATOR_USE_MONOCHROME_STYLE_CLASS)
				if (!indicatorIcon.has_style_class_name(PRIVACY_INDICATOR_STYLE_CLASS)) return
				if (this.privacyIndicatorStyle == "accent") {
					indicatorIcon.add_style_class_name(PRIVACY_INDICATOR_USE_ACCENT_STYLE_CLASS)
				} else if (this.privacyIndicatorStyle == "monochrome") {
					indicatorIcon.add_style_class_name(PRIVACY_INDICATOR_USE_MONOCHROME_STYLE_CLASS)
				}
			} finally {
				updating = false
			}
		}
		updateStyle()
		maid.connectJob(indicatorIcon, "notify::style-class", updateStyle)
		maid.functionJob(() => {
			indicatorIcon.remove_style_class_name(PRIVACY_INDICATOR_USE_ACCENT_STYLE_CLASS)
			indicatorIcon.remove_style_class_name(PRIVACY_INDICATOR_USE_MONOCHROME_STYLE_CLASS)
		})
	}
	override onLoad(): void {
		// Colored privacy indicator
		const privacyIndicatorStyle = new StyleClass(Global.Indicators.style_class)
		if (this.privacyIndicatorStyle == "accent") {
			privacyIndicatorStyle.add(PRIVACY_INDICATOR_USE_ACCENT_STYLE_CLASS)
		} else if (this.privacyIndicatorStyle == "monochrome") {
			privacyIndicatorStyle.add(PRIVACY_INDICATOR_USE_MONOCHROME_STYLE_CLASS)
		}
		if (privacyIndicatorStyle.modified) {
			Global.Indicators.style_class = privacyIndicatorStyle.stringify()
			this.maid.functionJob(()=>{
				Global.Indicators.style_class =
					new StyleClass(Global.Indicators.style_class)
					.remove(PRIVACY_INDICATOR_USE_ACCENT_STYLE_CLASS)
					.remove(PRIVACY_INDICATOR_USE_MONOCHROME_STYLE_CLASS)
					.stringify()
			})
		}

		// Colored screen sharing indicator
		if (this.accentScreenSharingIndicator) {
			Main.panel.statusArea["screenSharing"].style_class =
				new StyleClass(Main.panel.statusArea["screenSharing"].style_class)
				.add("QSTWEAKS-screen-sharing-indicator-use-accent")
				.stringify()
			this.maid.functionJob(()=>{
				Main.panel.statusArea["screenSharing"].style_class =
					new StyleClass(Main.panel.statusArea["screenSharing"].style_class)
					.remove("QSTWEAKS-screen-sharing-indicator-use-accent")
					.stringify()
			})
		}

		// Colored screen recording indicator
		if (this.accentScreenRecordingIndicator) {
			Main.panel.statusArea["screenRecording"].style_class =
				new StyleClass(Main.panel.statusArea["screenRecording"].style_class)
				.add("QSTWEAKS-screen-recording-indicator-use-accent")
				.stringify()
			this.maid.functionJob(()=>{
				Main.panel.statusArea["screenRecording"].style_class =
					new StyleClass(Main.panel.statusArea["screenRecording"].style_class)
					.remove("QSTWEAKS-screen-recording-indicator-use-accent")
					.stringify()
			})
		}

		// Ordering and per-indicator styling
		this.tracker = new SystemIndicatorTracker()
		this.tracker.onIndicatorCreated = (maid, indicator) => {
			this.applyPrivacyIndicatorStyle(maid, indicator)
			if (this.orderEnabled) this.onIndicatorCreated(maid, indicator)
		}
		if (this.orderEnabled) this.tracker.onUpdate = this.onUpdate.bind(this)
		this.tracker.load()
	}
	override onUnload(): void {
		const tracker = this.tracker
		if (tracker) {
			this.tracker = null
			tracker.unload()
		}
	}
}
