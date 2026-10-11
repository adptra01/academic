'use client'

// React Imports
import { useMemo } from 'react'

// Component Imports
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

type Variable = { id: string; name: string; var_type: string; var_role: string }

/**
 * Spec bertipe dari `GET /api/v1/methods/{id}`.
 *   variables: { kolom dataset }  — kind menentukan kolom mana yang boleh dipilih
 *   params:     { parameter metode } — number / int / enum / number_list
 * `kind` dari spec ini dipakai langsung; tidak ada lagi tebakan regex dari
 * string bebas (tebakan itu dulu membuat `mu`, `n_clusters`, `mode`, dan
 * `expected` tampil sebagai dropdown kolom, sehingga 5 metode tak bisa dipakai).
 */
type ColSpec = { kind: 'any' | 'numeric' | 'categorical' | 'group' | 'text'; label: string; multi?: boolean }

type ParamSpec = {
  kind: 'number' | 'int' | 'enum' | 'number_list'
  label: string
  required?: boolean
  default?: string | number
  options?: string[]
  min?: number
  max?: number
  hint?: string
}

type Spec = {
  variables?: Record<string, ColSpec>
  params?: Record<string, ParamSpec>
}

/** Tebakan peran kolom untuk kunci tertentu (saran otomatis di dropdown). */
const KEY_ROLE_HINT: Record<string, string> = {
  x: 'Independent',
  xs: 'Independent',
  col1: 'Independent',
  col2: 'Independent',
  y: 'Dependent',
  column: 'Dependent',
  target: 'Dependent',
  group: 'Grouping'
}

const isCategoricalType = (t: string) => /nominal|ordinal|binary|categor/i.test(t)
const isNumericType = (t: string) => /numerical|numeric|number|int|float|decimal/i.test(t)
const isTextType = (t: string) => /text/i.test(t)

type Props = {
  spec: Spec
  variables: Variable[]
  value: Record<string, string[]>
  params: Record<string, string>
  onChange: (next: Record<string, string[]>) => void
  onParamsChange: (next: Record<string, string>) => void
}

const VariablePicker = ({ spec, variables, value, params, onChange, onParamsChange }: Props) => {
  const varEntries = useMemo(() => Object.entries(spec?.variables ?? {}), [spec])

  const setCol = (key: string, cols: string[]) => {
    const next = { ...value }

    if (cols.length === 0) delete next[key]
    else next[key] = cols
    onChange(next)
  }

  const setParam = (key: string, v: string) => {
    const next = { ...params }

    if (v === '') delete next[key]
    else next[key] = v
    onParamsChange(next)
  }

  if (varEntries.length === 0 && Object.keys(spec?.params ?? {}).length === 0) {
    return <p className='text-muted-foreground text-xs leading-relaxed'>Metode ini tidak butuh kolom atau parameter tambahan.</p>
  }

  return (
    <div className='space-y-5'>
      {varEntries.map(([key, cs]) => {
        const hint = KEY_ROLE_HINT[key]

        const candidates = variables.filter(v => {
          if (cs.kind === 'numeric') return isNumericType(v.var_type)
          if (cs.kind === 'categorical' || cs.kind === 'group') return isCategoricalType(v.var_type)
          if (cs.kind === 'text') return isTextType(v.var_type)

          return true
        })

        // Kolom yang perannya cocok diurutkan ke atas (saran, bukan paksaan).
        const sorted = [...candidates].sort((a, b) => {
          const ah = hint && a.var_role === hint ? 0 : 1
          const bh = hint && b.var_role === hint ? 0 : 1

          return ah - bh
        })

        const selected = value[key] ?? []

        return (
          <Field key={key} className='gap-2'>
            <FieldLabel htmlFor={`pick-${key}`}>{cs.label}</FieldLabel>

            {cs.multi ? (
              <div className='flex flex-wrap gap-1.5'>
                {sorted.length === 0 && <p className='text-muted-foreground text-xs'>Tidak ada kolom yang cocok pada versi ini.</p>}
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
              <Select value={selected[0] ?? ''} onValueChange={val => setCol(key, val && val !== '__none' ? [val] : [])}>
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

      {/* Parameter metode: angka & opsi — BUKAN kolom dataset. */}
      {Object.keys(spec?.params ?? {}).length > 0 && (
        <div className='space-y-4 border-t border-rule pt-4'>
          <p className='text-muted-foreground text-[11px] leading-relaxed'>
            Parameter metode (bukan kolom dari dataset)
          </p>
          {Object.entries(spec?.params ?? {}).map(([key, ps]) => (
            <Field key={key} className='gap-2'>
              <FieldLabel htmlFor={`param-${key}`}>
                {ps.label}
                {ps.required && <span className='text-destructive ml-1'>*</span>}
              </FieldLabel>

              {ps.kind === 'enum' ? (
                <Select value={params[key] ?? ps.default ?? ''} onValueChange={v => setParam(key, v ?? '')}>
                  <SelectTrigger id={`param-${key}`}>
                    <SelectValue placeholder={ps.default ?? 'Pilih…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(ps.options ?? []).map(o => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`param-${key}`}
                  type='number'
                  step={ps.kind === 'int' ? 1 : 'any'}
                  min={ps.min}
                  max={ps.max}
                  value={params[key] ?? ''}
                  placeholder={ps.hint ?? (ps.default !== undefined ? String(ps.default) : '')}
                  onChange={e => setParam(key, e.target.value)}
                />
              )}

              {ps.hint && <p className='text-muted-foreground text-xs'>{ps.hint}</p>}
            </Field>
          ))}
        </div>
      )}
    </div>
  )
}

export default VariablePicker