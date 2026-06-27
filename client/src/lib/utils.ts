export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatEnergy(val: string | number): string {
  return Number(val).toLocaleString('vi-VN')
}

export function displayChoice(choice: 'T' | 'X'): string {
  return choice === 'T' ? '₮' : 'Ӿ'
}
