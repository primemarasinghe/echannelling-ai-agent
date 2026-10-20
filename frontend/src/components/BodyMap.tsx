import BodyMapImage from './BodyMapImage'

export interface BodyFocus {
  view: 'front' | 'back'
  zoom: number
  cy: number  // SVG y-coordinate to centre on (0–1500)
}

export type BodyRegion =
  | 'head-right' | 'head-left'
  | 'right-eye' | 'left-eye'
  | 'nose' | 'mouth'
  | 'right-ear' | 'left-ear'
  | 'neck'
  | 'right-shoulder' | 'left-shoulder'
  | 'chest-right'    | 'chest-left'
  | 'abdomen'
  | 'upper-back-right' | 'upper-back-left'
  | 'lower-back'
  | 'right-arm'  | 'left-arm'
  | 'right-hand' | 'left-hand'
  | 'right-hip'  | 'left-hip'
  | 'bladder'
  | 'right-leg'  | 'left-leg'
  | 'right-knee' | 'left-knee'
  | 'right-toes' | 'left-toes'

interface RegionMeta {
  id: BodyRegion
  label: string
  si: string
  views: ('front' | 'back')[]
}

export const REGION_META: RegionMeta[] = [
  { id: 'head-right',       label: 'Head Right',       si: 'දකුණු ඔළුව',        views: ['front','back'] },
  { id: 'head-left',        label: 'Head Left',        si: 'වම් ඔළුව',          views: ['front','back'] },
  { id: 'right-eye',        label: 'Right Eye',        si: 'දකුණු ඇස',          views: ['front']        },
  { id: 'left-eye',         label: 'Left Eye',         si: 'වම් ඇස',            views: ['front']        },
  { id: 'nose',             label: 'Nose',             si: 'නාසය',              views: ['front']        },
  { id: 'mouth',            label: 'Mouth',            si: 'මුඛය',              views: ['front']        },
  { id: 'right-ear',        label: 'Right Ear',        si: 'දකුණු කන',          views: ['front']        },
  { id: 'left-ear',         label: 'Left Ear',         si: 'වම් කන',            views: ['front']        },
  { id: 'neck',             label: 'Neck',             si: 'බෙල්ල',             views: ['front','back'] },
  { id: 'right-shoulder',   label: 'Right Shoulder',   si: 'දකුණු උරහිස',       views: ['front','back'] },
  { id: 'left-shoulder',    label: 'Left Shoulder',    si: 'වම් උරහිස',         views: ['front','back'] },
  { id: 'chest-right',      label: 'Right Chest',      si: 'දකුණු පපුව',        views: ['front']        },
  { id: 'chest-left',       label: 'Left Chest',       si: 'වම් පපුව',          views: ['front']        },
  { id: 'abdomen',          label: 'Abdomen',          si: 'බඩ',                views: ['front']        },
  { id: 'upper-back-right', label: 'Upper Back Right', si: 'දකුණු ඉහළ කොන්ද',  views: ['back']         },
  { id: 'upper-back-left',  label: 'Upper Back Left',  si: 'වම් ඉහළ කොන්ද',    views: ['back']         },
  { id: 'lower-back',       label: 'Lower Back',       si: 'කොඳු ඇටේ',          views: ['back']         },
  { id: 'right-arm',        label: 'Right Arm',        si: 'දකුණු අත',          views: ['front','back'] },
  { id: 'left-arm',         label: 'Left Arm',         si: 'වම් අත',            views: ['front','back'] },
  { id: 'right-hand',       label: 'Right Hand',       si: 'දකුණු අත',          views: ['front','back'] },
  { id: 'left-hand',        label: 'Left Hand',        si: 'වම් අත',            views: ['front','back'] },
  { id: 'right-hip',        label: 'Right Hip',        si: 'දකුණු කලව',         views: ['front','back'] },
  { id: 'left-hip',         label: 'Left Hip',         si: 'වම් කලව',           views: ['front','back'] },
  { id: 'bladder',          label: 'Bladder',          si: 'මුත්‍රාශය',           views: ['front']        },
  { id: 'right-leg',        label: 'Right Leg',        si: 'දකුණු කකුල',        views: ['front','back'] },
  { id: 'left-leg',         label: 'Left Leg',         si: 'වම් කකුල',          views: ['front','back'] },
  { id: 'right-knee',       label: 'Right Knee',       si: 'දකුණු දණහිස',       views: ['front','back'] },
  { id: 'left-knee',        label: 'Left Knee',        si: 'වම් දණහිස',         views: ['front','back'] },
  { id: 'right-toes',       label: 'Right Toes',       si: 'දකුණු ඇඟිලි',       views: ['front','back'] },
  { id: 'left-toes',        label: 'Left Toes',        si: 'වම් ඇඟිලි',         views: ['front','back'] },
]

interface Props {
  selected: BodyRegion[]
  onToggle: (r: BodyRegion) => void
  focus?: BodyFocus
  onHover?: (r: BodyRegion | null) => void
}

export default function BodyMap({ selected, onToggle, focus, onHover }: Props) {
  return <BodyMapImage selected={selected} onToggle={onToggle} focus={focus} onHover={onHover} />
}
