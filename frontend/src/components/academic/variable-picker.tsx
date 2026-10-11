'use client'

// React Imports
import { useMemo } from 'react'

// Component Imports
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

type Variable = { id: string; name: string; var_type: string; var_role: string }

/** Spec `variables` dari backend: kunci → keterangan (mis. "str numerik", "list[str] — 1..N kolom"). */
type Spec = Record<string, string> | undefined

// Kunci parameter (bukan kolom) yang tidak boleh Offer kolom.
const PARAM_KEYS = new Set(['method', 'mu', 'alpha', 'n_boot'])

/**
 * Klasifikasikan kunci spec → jenis kolom yang boleh dipilih:
 * - 'multi'   : list[str] — beberapa kolom numerik
 * - 'numeric' : kolom numerik
 * - 'categorical' : kolom kategorikal (nominal/ordinal/binary)
 * - 'group'   : kolom pengelompok (kategorikal)
 * - 'any'     : kolom apa saja
 */
const keyKind = (key: string, desc: string): 'multi' | 'numeric' | 'categorical' | 'group' | 'any' => {
  if (desc.includes('list[')) return 'multi'
  if (/grup|kelompok/i.test(desc)) return 'group'
  if (/numerik|number|numeric/i.test(desc)) return 'numeric'
  if (/kategor/i.test(desc)) return 'categorical'

  return 'any'
}

/** Tebakan peran kolom untuk kunci tertentu (dipakai sebagai saran otomatis). */
const KEY_ROLE_HINT: Record<string, string> = {
  x: 'Independent',
  col1: 'Independent',
  col2: 'Independent',
  y: 'Dependent',
  column: 'Dependent',
  group: 'Grouping'
}

const isCategoricalType = (t: string) => /nominal|ordinal|binary|categor/i.test(t)
const isNumericType = (t: string) => /numerical|numeric|number|int|float|decimal/i.test(t)

type Props = {
  spec: Spec
  variables: Variable[]
  value: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
}

/**
 * Pemilih kolom per kunci spec — menggantikan obligations mengetik JSON manual.
 * researches: menampilkan hanya kolom yang cocok dengan jenis yang diminta metode,
 * memberi saran kolom sesuai peran yang sudah di setting di Tahap 03.
 */
const VariablePicker = ({ spec, variables, value, onChange }: Props) => {
  const entries = useMemo(
    () => Object.entries(spec ?? {}).filter(([k]) => !PARAM_KEYS.has(k)),
    [spec]
  )

  if (entries.length === 0) {
    return (
      <p className='text-muted-foreground text-xs leading-relaxed'>
        Metode ini tidak butuh kolom tambahan.
      </p>
    )
  }

  const setCol = (key: string, cols: string[]) => {
    const next = { ...value }

    if (cols.length === 0) delete next[key]
    else next[key] = cols
    onChange(next)
  }

  return (
    <div className='space-y-4'>
      {entries.map(([key, desc]) => {
        const kind = keyKind(key, desc)

        //_filter kolom sesuai jenis_
        const candidates = variables.filter(v => {
          if (kind === 'numeric' || kind === 'multi') return isNumericType(v.var_type)
          if (kind === 'categorical' || kind === 'group') return isCategoricalType(v.var_type)

          return true
        })

        // Saran otomatis: kolom yang perannya cocok (mis. y → Dependent).
        const hint = KEY_ROLE_HINT[key]

        const sorted = [...candidates].sort((a, b) => {
          const ah = hint && a.var_role === hint ? 0 : 1
          const bh = hint && b.var_role === hint ? 0 : 1

          return ah - bh
        })

        const selected = value[key] ?? []

        return (
          <Field key={key} className='gap-2'>
            <FieldLabel htmlFor={`pick-${key}`}>
              {key === 'columns' ? 'Kolom (boleh beberapa)' : key}
              <span className='text-muted-foreground ml-1 font-mono text-[10px]'>({desc})</span>
            </FieldLabel>

            {kind === 'multi' ? (
              <div className='flex flex-wrap gap-1.5'>
                {sorted.length === 0 && (
                  <p className='text-muted-foreground text-xs'>Tidak ada kolom numerik pada versi ini.</p>
                )}
                {sorted.map(v => {
                  const on = selected.includes(v.name)

                  return (
                    <button
                      key={v.name}
                      type='button'
                      aria-pressed={on}
                      onClick={() => setCol(key, on ? selected.filter(c => c !== v.name) : [...selected, v.name])}
                      className={`pressable rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-rule-2 text-ink-2 hover:border-ink-4'
                      }`}
                    >
                      {v.name}
                    </button>
                  )
                })}
              </div>
            ) : (
              <Select
                value={selected[0] ?? ''}
                onValueChange={val => setCol(key, val && val !== '__none' ? [val] : [])}
              >
                <SelectTrigger id={`pick-${key}`}>
                  <SelectValue placeholder='Pilih kolom…' />
                </SelectTrigger>
                <SelectContent>
                  {sorted.length === 0 && (
                    <SelectItem value='__none' disabled>
                      Tidak ada kolom yang cocok
                    </SelectItem>
                  )}
                  {sorted.map(v => (
                    <SelectItem key={v.name} value={v.name}>
                      <span className='flex items-center gap-2'>
                        {v.name}
                        {hint && v.var_role === hint && <Badge variant='secondary'>{v.var_role}</Badge>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )
      })}
    </div>
  )
}

export default VariablePicker