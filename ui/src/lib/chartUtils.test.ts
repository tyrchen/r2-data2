import { describe, it, expect } from 'vitest';
import { aggregateData } from './chartUtils';

type DataRow = Record<string, unknown>;

const sampleData: DataRow[] = [
  { category: 'A', value: 10, count: 1, extra: 'foo' },
  { category: 'B', value: 20, count: 2, extra: 'bar' },
  { category: 'A', value: 15, count: 3, extra: 'baz' },
  { category: 'B', value: 25, count: 4, extra: 'qux' },
  { category: 'C', value: 30, count: 5, extra: 'quux' },
  { category: 'A', value: '5', count: 6, extra: 'corge' }, // String number
  { category: 'B', value: null, count: 7, extra: 'grault' }, // Null value
  { category: 'C', value: undefined, count: 8, extra: 'garply' }, // Undefined value
  { category: 'D', value: 40, count: '9', extra: 'waldo' }, // String count (should be ignored for sum/avg etc)
];

describe('aggregateData', () => {
  it('should return original data if no aggregation needed', () => {
    expect(aggregateData(sampleData, 'category', ['value'], 'none')).toEqual(sampleData);
    expect(aggregateData(sampleData, null, ['value'], 'sum')).toEqual(sampleData);
    expect(aggregateData(sampleData, 'category', [], 'sum')).toEqual(sampleData);
  });

  it('should aggregate by sum', () => {
    const result = aggregateData(sampleData, 'category', ['value'], 'sum');
    expect(result).toContainEqual({ category: 'A', value: 30 }); // 10 + 15 + 5 (parsed string)
    expect(result).toContainEqual({ category: 'B', value: 45 }); // 20 + 25 (null ignored)
    expect(result).toContainEqual({ category: 'C', value: 30 }); // 30 (undefined ignored)
    expect(result).toContainEqual({ category: 'D', value: 40 }); // 40
    expect(result.length).toBe(4);
  });

  it('should aggregate by average', () => {
    const result = aggregateData(sampleData, 'category', ['value'], 'average');
    expect(result).toContainEqual({ category: 'A', value: 10 }); // (10 + 15 + 5) / 3
    expect(result).toContainEqual({ category: 'B', value: 22.5 }); // (20 + 25) / 2
    expect(result).toContainEqual({ category: 'C', value: 30 }); // 30 / 1
    expect(result).toContainEqual({ category: 'D', value: 40 }); // 40 / 1
    expect(result.length).toBe(4);
  });

  it('should aggregate by count (counting valid numeric values)', () => {
    const result = aggregateData(sampleData, 'category', ['value'], 'count');
    expect(result).toContainEqual({ category: 'A', value: 3 }); // Three numeric values (10, 15, '5')
    expect(result).toContainEqual({ category: 'B', value: 2 }); // Two numeric values (20, 25)
    expect(result).toContainEqual({ category: 'C', value: 1 }); // One numeric value (30)
    expect(result).toContainEqual({ category: 'D', value: 1 }); // One numeric value (40)
    expect(result.length).toBe(4);
  });

  it('should aggregate by min', () => {
    const result = aggregateData(sampleData, 'category', ['value'], 'min');
    expect(result).toContainEqual({ category: 'A', value: 5 });
    expect(result).toContainEqual({ category: 'B', value: 20 });
    expect(result).toContainEqual({ category: 'C', value: 30 });
    expect(result).toContainEqual({ category: 'D', value: 40 });
    expect(result.length).toBe(4);
  });

  it('should aggregate by max', () => {
    const result = aggregateData(sampleData, 'category', ['value'], 'max');
    expect(result).toContainEqual({ category: 'A', value: 15 });
    expect(result).toContainEqual({ category: 'B', value: 25 });
    expect(result).toContainEqual({ category: 'C', value: 30 });
    expect(result).toContainEqual({ category: 'D', value: 40 });
    expect(result.length).toBe(4);
  });

  it('should aggregate multiple columns', () => {
    const result = aggregateData(sampleData, 'category', ['value', 'count'], 'sum');
    // value sums are the same as above
    // count sums: A: 1+3+6=10, B: 2+4+7=13, C: 5+8=13, D: 0 (string '9' ignored)
    expect(result).toContainEqual({ category: 'A', value: 30, count: 10 });
    expect(result).toContainEqual({ category: 'B', value: 45, count: 13 });
    expect(result).toContainEqual({ category: 'C', value: 30, count: 13 });
    expect(result).toContainEqual({ category: 'D', value: 40, count: 9 }); // '9' is string, parsed for sum
    expect(result.length).toBe(4);
  });

  it('should handle empty data input', () => {
    expect(aggregateData([], 'category', ['value'], 'sum')).toEqual([]);
  });

  it('should handle aggregation where all values for a group are non-numeric', () => {
    const nonNumericData: DataRow[] = [
      { category: 'X', value: 'abc' },
      { category: 'X', value: null },
      { category: 'Y', value: 100 },
    ];
    const sumResult = aggregateData(nonNumericData, 'category', ['value'], 'sum');
    expect(sumResult).toContainEqual({ category: 'X', value: null }); // Sum is null if no numeric values
    expect(sumResult).toContainEqual({ category: 'Y', value: 100 });

    const avgResult = aggregateData(nonNumericData, 'category', ['value'], 'average');
    expect(avgResult).toContainEqual({ category: 'X', value: NaN }); // Avg of empty set is NaN
    expect(avgResult).toContainEqual({ category: 'Y', value: 100 });

    const countResult = aggregateData(nonNumericData, 'category', ['value'], 'count');
    expect(countResult).toContainEqual({ category: 'X', value: 0 });
    expect(countResult).toContainEqual({ category: 'Y', value: 1 });

    const minResult = aggregateData(nonNumericData, 'category', ['value'], 'min');
    expect(minResult).toContainEqual({ category: 'X', value: Infinity }); // Min of empty set
    expect(minResult).toContainEqual({ category: 'Y', value: 100 });

    const maxResult = aggregateData(nonNumericData, 'category', ['value'], 'max');
    expect(maxResult).toContainEqual({ category: 'X', value: -Infinity }); // Max of empty set
    expect(maxResult).toContainEqual({ category: 'Y', value: 100 });
  });
});
