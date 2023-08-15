module.exports = (istr, mstr) => {
  if (mstr === '*') return {};
  const p0 = istr.split('/').filter(p => p);
  const p1 = mstr.split('/').filter(p => p);
  const out = {};
  if (p0.length > p1.length && p1.length > 0) {
    const last = p1[p1.length - 1];
    if (last[last.length - 1] !== '*') {
      return null;
    }
  } else if (p0.length !== p1.length) return null;
  for (let i = 0; i < p1.length; i++) {
    const p = p1[i];
    if (p[0] !== ':') {
      if (p !== p0[i]) return null;
      else continue;
    }
    if (i === p1.length - 1 && p[p.length - 1] === '*') {
      out[p.slice(1, -1)] = p0[i];
      for (let j = i + 1; j < p0.length; j++) {
        out[p.slice(1, -1)] += `/${p0[j]}`;
      }
    } else {
      out[p.slice(1)] = p0[i];
    }
  }
  return out;
};
