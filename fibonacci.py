def fibonacci(n):
    """返回前 n 个斐波那契数列"""
    if n <= 0:
        return []
    if n == 1:
        return [0]

    seq = [0, 1]
    for _ in range(2, n):
        seq.append(seq[-1] + seq[-2])
    return seq


if __name__ == "__main__":
    # 示例：打印前 10 个斐波那契数
    print(fibonacci(10))
